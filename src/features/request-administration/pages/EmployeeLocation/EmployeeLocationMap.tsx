import React, { useEffect, useMemo, useRef } from 'react';
import { LngLatBounds, Map as MapLibreMap, Marker, NavigationControl, setWorkerUrl, type MapMouseEvent } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import { SMSLoader } from '@/components/smsatoms';
import { EMPLOYEE_LOCATION } from '@/constants/strings';
import { cn } from '@/utils';
import { OPENFREEMAP_STYLE_URL, STATIC_OPENFREEMAP_STYLE_URL } from '@/utils/apiClient';
import type { DepartmentLocationResponse } from '@/types/department';
import { employeePinLabel, plotClusters, requesterPinTitles, type MapEmployee, type PlotCluster } from './locationRoster';

// Explicitly register workerUrl so Vite bundles and resolves the worker script correctly in production
if (typeof window !== 'undefined') {
  setWorkerUrl(workerUrl);
}

const DEFAULT_CENTER: [number, number] = [-87.6298, 41.8781];
const DEFAULT_ZOOM = 11;
const FOCUS_ZOOM = 15;
const PIN_SVG =
  '<svg viewBox="0 0 24 36" width="28" height="42" aria-hidden="true"><path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 24 12 24s12-15 12-24C24 5.4 18.6 0 12 0z" fill="currentColor"/><circle cx="12" cy="12" r="4.5" fill="#fff"/></svg>';
const VEHICLE_SVG =
  '<svg viewBox="0 0 48 28" width="40" height="24" aria-hidden="true"><rect x="4" y="10" width="40" height="12" rx="3" fill="#1e3a5f"/><path d="M12 10 L16 4 H32 L36 10 Z" fill="#3b82f6"/><circle cx="14" cy="22" r="3.5" fill="#0f172a"/><circle cx="14" cy="22" r="1.5" fill="#cbd5e1"/><circle cx="34" cy="22" r="3.5" fill="#0f172a"/><circle cx="34" cy="22" r="1.5" fill="#cbd5e1"/><rect x="18" y="5" width="6" height="4" rx="1" fill="#bfdbfe"/><rect x="26" y="5" width="6" height="4" rx="1" fill="#bfdbfe"/></svg>';
const DEPARTMENT_PIN_SVG =
  '<svg viewBox="0 0 32 42" width="32" height="42" aria-hidden="true"><path d="M16 0C7.2 0 0 7.2 0 16c0 13 16 26 16 26s16-13 16-26C32 7.2 24.8 0 16 0z" fill="#1e3a8a"/><circle cx="16" cy="15" r="11" fill="#2563eb"/><path d="M16 7l6 3v5c0 4-2.5 7.5-6 8.5-3.5-1-6-4.5-6-8.5v-5z" fill="#ffffff"/><path d="M16 9.5l4 2v3.5c0 2.5-1.5 5-4 5.5-2.5-.5-4-3-4-5.5v-3.5z" fill="#1e3a8a"/></svg>';

function resetMarkers(markersRef: React.MutableRefObject<Marker[]>) {
  markersRef.current.forEach((marker) => marker.remove());
  markersRef.current = [];
}

function isMovingPin(cluster: PlotCluster) {
  return cluster.employees.length === 1 && cluster.employees[0].moving;
}

function buildDepartmentMarkerEl(dept: DepartmentLocationResponse): HTMLElement {
  const root = document.createElement('div');
  root.className = 'employee-location__pin is-department';
  root.insertAdjacentHTML('afterbegin', DEPARTMENT_PIN_SVG);

  const label = document.createElement('span');
  label.className = 'employee-location__pin-label is-stack is-department-label';

  const title = document.createElement('span');
  title.className = 'employee-location__pin-label-title is-department-title';
  title.textContent = dept.departmentName || dept.departmentCode || 'Department Location';
  label.append(title);

  const addressParts = [dept.address, dept.city, dept.state, dept.zip].filter(Boolean).join(', ');
  if (addressParts) {
    const addr = document.createElement('span');
    addr.className = 'employee-location__pin-label-row is-department-address';
    addr.textContent = addressParts;
    label.append(addr);
  }

  root.append(label);
  root.addEventListener('click', (event) => {
    event.stopPropagation();
    root.classList.toggle('is-selected');
  });
  return root;
}

function buildMarkerEl(
  cluster: PlotCluster,
  selectedEmployeeId: string | null,
  onSelect?: (employee: MapEmployee) => void
): HTMLElement {
  const selected = cluster.employees.some((employee) => employee.employeeId === selectedEmployeeId);
  const moving = isMovingPin(cluster);
  const titles = requesterPinTitles(cluster.employees);
  const stacked = cluster.employees.length > 1 || titles.length > 0;
  const root = document.createElement('div');
  root.className = cn(
    'employee-location__pin',
    selected && 'is-selected',
    moving && 'is-moving',
    stacked && 'is-stack',
    cluster.labelLeft && 'is-label-left'
  );
  root.insertAdjacentHTML('afterbegin', moving ? VEHICLE_SVG : PIN_SVG);

  const label = document.createElement('span');
  label.className = cn('employee-location__pin-label', stacked && 'is-stack');
  for (const title of titles) {
    const heading = document.createElement('span');
    heading.className = 'employee-location__pin-label-title';
    heading.textContent = title;
    label.append(heading);
  }
  for (const employee of cluster.employees) {
    const row = document.createElement('span');
    row.className = cn(
      'employee-location__pin-label-row',
      employee.employeeId === selectedEmployeeId && 'is-active'
    );
    row.textContent = employeePinLabel(employee);
    row.addEventListener('click', (event) => {
      event.stopPropagation();
      onSelect?.(employee);
    });
    label.append(row);
  }
  root.append(label);
  root.addEventListener('click', (event) => {
    event.stopPropagation();
    onSelect?.(
      cluster.employees.find((employee) => employee.employeeId === selectedEmployeeId) ??
        cluster.employees[0]
    );
  });
  return root;
}

export const EmployeeLocationMap: React.FC<{
  employees: MapEmployee[];
  selectedEmployeeId: string | null;
  requestId?: string | null;
  activePostId?: string | null;
  loading?: boolean;
  departmentLocation?: DepartmentLocationResponse | null;
  onSelectEmployee?: (employee: MapEmployee) => void;
  onClearSelection?: () => void;
}> = ({
  employees,
  selectedEmployeeId,
  requestId,
  activePostId,
  loading = false,
  departmentLocation: departmentLocationProp,
  onSelectEmployee,
  onClearSelection,
}) => {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const departmentMarkerRef = useRef<Marker | null>(null);
  const framedKeyRef = useRef<string | null>(null);
  const prevTargetKeyRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelectEmployee);
  onSelectRef.current = onSelectEmployee;
  const onClearSelectionRef = useRef(onClearSelection);
  onClearSelectionRef.current = onClearSelection;

  const deptLocation = departmentLocationProp ?? null;

  const deptCoords = useMemo<[number, number] | null>(() => {
    if (!deptLocation) return null;
    const lat = Number(deptLocation.latitude);
    const lon = Number(deptLocation.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    if (lat < -90 || lat > 90 || lon < -180 || lon > 180) return null;
    return [lon, lat];
  }, [deptLocation]);

  const currentTargetKey = `${requestId ?? ''}:${activePostId ?? ''}`;
  if (prevTargetKeyRef.current !== currentTargetKey) {
    prevTargetKeyRef.current = currentTargetKey;
    framedKeyRef.current = null;
  }

  const clusters = useMemo(() => plotClusters(employees), [employees]);
  const waiting = loading && clusters.length === 0;

  useEffect(() => {
    const container = mapRef.current;
    if (!container || mapInstance.current) return;

    const initialCenter =
      clusters.length > 0
        ? ([clusters[0].point.longitude, clusters[0].point.latitude] as [number, number])
        : deptCoords ?? DEFAULT_CENTER;
    const initialZoom = clusters.length > 0 ? FOCUS_ZOOM : deptCoords ? 14 : DEFAULT_ZOOM;

    const map = new MapLibreMap({
      container,
      style: OPENFREEMAP_STYLE_URL,
      center: initialCenter,
      zoom: initialZoom,
    });

    // If configured style URL fails to load for any reason, fallback to static style
    if (OPENFREEMAP_STYLE_URL !== STATIC_OPENFREEMAP_STYLE_URL) {
      let hasFallenBack = false;
      map.on('error', (e) => {
        if (!hasFallenBack && (e?.error?.message?.includes('style') || e?.error?.message?.includes('Failed to fetch') || !map.isStyleLoaded())) {
          hasFallenBack = true;
          console.warn(
            `Map style failed to load from ${OPENFREEMAP_STYLE_URL}. Falling back to static OpenFreeMap style: ${STATIC_OPENFREEMAP_STYLE_URL}`,
            e
          );
          try {
            map.setStyle(STATIC_OPENFREEMAP_STYLE_URL);
          } catch (styleErr) {
            console.error('Failed to set fallback map style:', styleErr);
          }
        }
      });
    }
    map.addControl(new NavigationControl({ showCompass: false }), 'top-right');
    mapInstance.current = map;

    const resize = () => map.resize();
    map.on('load', resize);
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);
    requestAnimationFrame(resize);

    const handleMapClick = (event: MapMouseEvent) => {
      const target = event.originalEvent.target as HTMLElement | null;
      if (
        target?.closest('.employee-location__pin') ||
        target?.closest('.maplibregl-ctrl') ||
        target?.closest('.maplibregl-ctrl-group')
      ) {
        return;
      }
      departmentMarkerRef.current?.getElement().classList.remove('is-selected');
      onClearSelectionRef.current?.();
    };
    map.on('click', handleMapClick);

    return () => {
      map.off('click', handleMapClick);
      resizeObserver.disconnect();
      resetMarkers(markersRef);
      if (departmentMarkerRef.current) {
        departmentMarkerRef.current.remove();
        departmentMarkerRef.current = null;
      }
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapInstance.current;
    if (!map) return;

    resetMarkers(markersRef);
    if (departmentMarkerRef.current) {
      departmentMarkerRef.current.remove();
      departmentMarkerRef.current = null;
    }

    if (!clusters.length) {
      if (deptCoords && deptLocation) {
        const deptMarker = new Marker({
          element: buildDepartmentMarkerEl(deptLocation),
          anchor: 'bottom',
          subpixelPositioning: true,
        })
          .setLngLat(deptCoords)
          .addTo(map);
        departmentMarkerRef.current = deptMarker;

        const deptKey = `dept:${deptCoords[0].toFixed(5)},${deptCoords[1].toFixed(5)}`;
        if (framedKeyRef.current !== deptKey) {
          framedKeyRef.current = deptKey;
          map.jumpTo({ center: deptCoords, zoom: 14 });
        }
      } else {
        if (!framedKeyRef.current) {
          framedKeyRef.current = 'default';
          map.jumpTo({ center: DEFAULT_CENTER, zoom: DEFAULT_ZOOM });
        }
      }
      return;
    }

    const bounds = new LngLatBounds();

    for (const cluster of clusters) {
      const movingPin = isMovingPin(cluster);
      const marker = new Marker({
        element: buildMarkerEl(cluster, selectedEmployeeId, (picked) => onSelectRef.current?.(picked)),
        anchor: movingPin ? 'center' : 'bottom',
        subpixelPositioning: true,
      })
        .setLngLat([cluster.point.longitude, cluster.point.latitude])
        .addTo(map);
      markersRef.current.push(marker);
      bounds.extend([cluster.point.longitude, cluster.point.latitude]);
    }

    const clustersKey = clusters
      .map((c: PlotCluster) => `${c.point.longitude.toFixed(5)},${c.point.latitude.toFixed(5)}`)
      .join(';');

    const frame = () => {
      map.resize();
      if (selectedEmployeeId || framedKeyRef.current) return;
      framedKeyRef.current = clustersKey;
      if (clusters.length === 1) {
        const only = clusters[0].point;
        map.jumpTo({ center: [only.longitude, only.latitude], zoom: FOCUS_ZOOM });
        return;
      }
      map.fitBounds(bounds, { padding: 56, maxZoom: FOCUS_ZOOM, duration: 0 });
    };

    let timer: ReturnType<typeof setTimeout> | null = null;
    if (map.isStyleLoaded()) {
      frame();
    } else {
      map.once('load', frame);
      timer = setTimeout(() => {
        frame();
      }, 600);
    }

    return () => {
      map.off('load', frame);
      if (timer) clearTimeout(timer);
    };
  }, [clusters, selectedEmployeeId, deptCoords, deptLocation]);

  return (
    <div className="employee-location__map-shell">
      {waiting ? (
        <div className="employee-location__map-overlay">
          <SMSLoader loadingText={EMPLOYEE_LOCATION.MAP_LOADING} aria-label={EMPLOYEE_LOCATION.MAP_LOADING} />
        </div>
      ) : null}
      {!waiting && clusters.length === 0 ? (
        <p className={cn('employee-location__map-banner', deptCoords && 'is-department')}>
          {deptCoords && deptLocation ? (
            <>
              <strong>Department Location:</strong> {deptLocation.departmentName || deptLocation.departmentCode}
              {deptLocation.address
                ? ` — ${[deptLocation.address, deptLocation.city, deptLocation.state].filter(Boolean).join(', ')}`
                : ''}
            </>
          ) : (
            EMPLOYEE_LOCATION.NO_COORDINATES
          )}
        </p>
      ) : null}
      <div ref={mapRef} className="employee-location__map" role="region" aria-label={EMPLOYEE_LOCATION.MAP_REGION} />
    </div>
  );
};
