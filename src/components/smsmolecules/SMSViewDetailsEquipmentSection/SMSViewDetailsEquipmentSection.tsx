import React, { useMemo } from 'react';

import { SMSCard, SMSGrid, SMSStack, SMSTypography, SMSBox } from '@/components/smsatoms';
import { SMSDataDisplay } from '@/components/smsmolecules';
import { formatBool } from '@/components/smsmolecules/SMSCloseForm/utils';
import { formatCurrency } from '@/utils/formatters';
import { formatMileageCharge } from '@/types/invoice';
import { POST_POSITION } from '@/constants/strings';
import type { PostEquipmentDto } from '@/services/postEquipmentService';
import type { PostPositionResponse } from '@/types/postPosition';

export type SMSViewDetailsEquipmentSectionProps = {
  equipmentRaw: PostEquipmentDto[];
  /** Root view-details flags (used when `postPositionDetails` is null). */
  rootShowVehicle?: boolean;
  rootShowEquipment?: boolean;
  /** Optional post-position row for legacy `postRequires*` / `show*` fields. */
  postPositionDetails?: PostPositionResponse | null;
};

function splitByVehicleFlag(raw: PostEquipmentDto[]): { vehicles: PostEquipmentDto[]; equipment: PostEquipmentDto[] } {
  if (raw.length === 0) {
    return { vehicles: [], equipment: [] };
  }
  return {
    vehicles: raw.filter((i) => i.isVehicle === true),
    equipment: raw.filter((i) => i.isVehicle !== true),
  };
}

function readShowVehicle(postRaw: Record<string, unknown> | null, rootShow?: boolean): boolean {
  return (
    rootShow === true ||
    postRaw?.showVehicle === true ||
    postRaw?.ShowVehicle === true ||
    postRaw?.postRequiresVehicle === true ||
    postRaw?.PostRequiresVehicle === true ||
    postRaw?.requiresVehicle === true ||
    postRaw?.vehicleRequired === true
  );
}

function readShowEquipment(postRaw: Record<string, unknown> | null, rootShow?: boolean): boolean {
  return (
    rootShow === true ||
    postRaw?.showEquipment === true ||
    postRaw?.ShowEquipment === true ||
    postRaw?.postRequiresEquipment === true ||
    postRaw?.PostRequiresEquipment === true ||
    postRaw?.requiresEquipment === true ||
    postRaw?.equipmentRequired === true
  );
}

function rowKey(line: PostEquipmentDto, idx: number): string {
  const id = String(line.postEquipmentID ?? line.departmentEquipmentID ?? '').trim();
  return id || `equipment-row-${idx}`;
}

function titleForLine(line: PostEquipmentDto, unknownLabel: string): string {
  const t = line.equipmentName?.trim() || line.equipmentTypeName?.trim();
  return t || unknownLabel;
}

function perLabel(line: PostEquipmentDto): string | null {
  if (line.equipmentPerPostPosition && !line.equipmentPerPost) return 'Position';
  if (line.equipmentPerPost) return 'Job';
  return null;
}

/**
 * Vehicle + equipment cards for view-details (available post + post-by-status modals).
 * Uses only merged `requestEquipments` / `postEquipments` from view-details — no department catalog API.
 */
export const SMSViewDetailsEquipmentSection: React.FC<SMSViewDetailsEquipmentSectionProps> = ({
  equipmentRaw,
  rootShowVehicle = false,
  rootShowEquipment = false,
  postPositionDetails = null,
}) => {
  const postRaw = (postPositionDetails ?? null) as unknown as Record<string, unknown> | null;

  const { vehicles: vehicleItems, equipment: equipmentItems } = useMemo(
    () => splitByVehicleFlag(equipmentRaw),
    [equipmentRaw]
  );

  const showVehicleFromApi = readShowVehicle(postRaw, rootShowVehicle);
  const showEquipmentFromApi = readShowEquipment(postRaw, rootShowEquipment);

  const showEquipmentCards = showEquipmentFromApi && equipmentItems.length > 0;
  const showVehicleCards = showVehicleFromApi && vehicleItems.length > 0;

  if (!showEquipmentCards && !showVehicleCards) return null;

  const bothColumns = showEquipmentCards && showVehicleCards;

  return (
    <SMSBox sx={{ pt: 0.5, pb: 2, width: '100%' }}>
      {bothColumns ? (
        <SMSBox
          sx={{
            display: 'flex',
            flexDirection: { xs: 'column', md: 'row' },
            gap: 2,
            alignItems: 'flex-start',
            position: 'relative'
          }}
        >
          {showEquipmentCards && (
            <SMSBox sx={{ flex: 1, pb: 0.5, minWidth: 0, pr: { xs: 0, md: 2 } }}>
              <SMSStack spacing={2}>
                <SMSTypography variant="subtitle2" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                  {POST_POSITION.DETAIL_MODAL.POST_DETAILS_EQUIPMENT_SECTION}
                </SMSTypography>
                {equipmentItems.map((equipment, idx) => (
                  <SMSStack key={rowKey(equipment, idx)} spacing={2}>
                    {idx > 0 && (
                      <SMSBox sx={{ height: '1px', backgroundColor: 'divider', my: 1 }} />
                    )}
                    <SMSGrid container spacing={1}>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" fontWeight={700}>
                          {titleForLine(equipment, POST_POSITION.DETAIL_MODAL.UNKNOWN_EQUIPMENT)}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" color="text.secondary">
                          Quantity: {equipment.equipmentQuantity}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" color="text.secondary">
                          {perLabel(equipment) ? `Per: ${perLabel(equipment)}` : ''}
                        </SMSTypography>
                      </SMSGrid>
                    </SMSGrid>
                    <SMSGrid container spacing={1}>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Charge"
                          value={formatCurrency(equipment.charge)}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Requires Approval"
                          value={formatBool(equipment.requiresApproval)}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      {equipment.requiresUtilizationRecorded === true && (
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Utilization Recorded"
                            value={formatBool(equipment.requiresUtilizationRecorded)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                      )}
                    </SMSGrid>
                  </SMSStack>
                ))}
              </SMSStack>
            </SMSBox>
          )}

          {showEquipmentCards && showVehicleCards && (
            <>
              <SMSBox 
                sx={{ 
                  display: { xs: 'none', md: 'block' }, 
                  position: 'absolute',
                  left: '50%',
                  top: 0,
                  bottom: 0,
                  width: '1px',
                  backgroundColor: 'divider',
                  transform: 'translateX(-50%)'
                }} 
              />
              <SMSBox sx={{ display: { xs: 'block', md: 'none' }, height: '1px', backgroundColor: 'divider', my: 2 }} />
            </>
          )}

          {showVehicleCards && (
            <SMSBox sx={{ flex: 1, pb: 0.5, minWidth: 0 }}>
              <SMSStack spacing={2}>
                <SMSTypography variant="subtitle2" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                  {POST_POSITION.DETAIL_MODAL.POST_DETAILS_VEHICLE_SECTION}
                </SMSTypography>
                {vehicleItems.map((vehicle, idx) => (
                  <SMSStack key={rowKey(vehicle, idx)} spacing={2}>
                    {idx > 0 && (
                      <SMSBox sx={{ height: '1px', backgroundColor: 'divider', my: 1 }} />
                    )}
                    <SMSGrid container spacing={1}>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" fontWeight={700}>
                          {titleForLine(vehicle, POST_POSITION.DETAIL_MODAL.UNKNOWN_VEHICLE)}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" color="text.secondary">
                          Quantity: {vehicle.equipmentQuantity}
                        </SMSTypography>
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4}>
                        <SMSTypography variant="subtitle1" color="text.secondary">
                          {perLabel(vehicle) ? `Per: ${perLabel(vehicle)}` : ''}
                        </SMSTypography>
                      </SMSGrid>
                    </SMSGrid>
                    <SMSGrid container spacing={1}>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Charge"
                          value={formatCurrency(vehicle.charge)}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Mileage Charge"
                          value={formatMileageCharge(vehicle.mileageCharge, '-')}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Charge Mileage"
                          value={formatBool(vehicle.chargeMileage)}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                        <SMSDataDisplay
                          variant="inline"
                          label="Requires Approval"
                          value={formatBool(vehicle.requiresApproval)}
                          labelFontWeight={600}
                        />
                      </SMSGrid>
                      {vehicle.requiresUtilizationRecorded === true && (
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Utilization Recorded"
                            value={formatBool(vehicle.requiresUtilizationRecorded)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                      )}
                    </SMSGrid>
                  </SMSStack>
                ))}
              </SMSStack>
            </SMSBox>
          )}
        </SMSBox>
      ) : (
        <SMSBox>
          {showEquipmentCards && (
            <SMSBox sx={{ pb: 0.5, minWidth: 0 }}>
              <SMSCard variant="outlined" sx={{ p: 2 }}>
                <SMSStack spacing={2}>
                  <SMSTypography variant="subtitle2" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                    {POST_POSITION.DETAIL_MODAL.POST_DETAILS_EQUIPMENT_SECTION}
                  </SMSTypography>
                  {equipmentItems.map((equipment, idx) => (
                    <SMSStack key={rowKey(equipment, idx)} spacing={2}>
                      {idx > 0 && (
                        <SMSBox sx={{ height: '1px', backgroundColor: 'divider', my: 1 }} />
                      )}
                      <SMSGrid container spacing={1}>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" fontWeight={700}>
                            {titleForLine(equipment, POST_POSITION.DETAIL_MODAL.UNKNOWN_EQUIPMENT)}
                          </SMSTypography>
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" color="text.secondary">
                            Quantity: {equipment.equipmentQuantity}
                          </SMSTypography>
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" color="text.secondary">
                            {perLabel(equipment) ? `Per: ${perLabel(equipment)}` : ''}
                          </SMSTypography>
                        </SMSGrid>
                      </SMSGrid>
                      <SMSGrid container spacing={1}>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Charge"
                            value={formatCurrency(equipment.charge)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Requires Approval"
                            value={formatBool(equipment.requiresApproval)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        {equipment.requiresUtilizationRecorded === true && (
                          <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                            <SMSDataDisplay
                              variant="inline"
                              label="Utilization Recorded"
                              value={formatBool(equipment.requiresUtilizationRecorded)}
                              labelFontWeight={600}
                            />
                          </SMSGrid>
                        )}
                      </SMSGrid>
                    </SMSStack>
                  ))}
                </SMSStack>
              </SMSCard>
            </SMSBox>
          )}

          {showVehicleCards && (
            <SMSBox sx={{ pb: 0.5, minWidth: 0 }}>
              <SMSCard variant="outlined" sx={{ p: 2 }}>
                <SMSStack spacing={2}>
                  <SMSTypography variant="subtitle2" className="modal-header heading-color" sx={{ fontWeight: 700 }}>
                    {POST_POSITION.DETAIL_MODAL.POST_DETAILS_VEHICLE_SECTION}
                  </SMSTypography>
                  {vehicleItems.map((vehicle, idx) => (
                    <SMSStack key={rowKey(vehicle, idx)} spacing={2}>
                      {idx > 0 && (
                        <SMSBox sx={{ height: '1px', backgroundColor: 'divider', my: 1 }} />
                      )}
                      <SMSGrid container spacing={1}>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" fontWeight={700}>
                            {titleForLine(vehicle, POST_POSITION.DETAIL_MODAL.UNKNOWN_VEHICLE)}
                          </SMSTypography>
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" color="text.secondary">
                            Quantity: {vehicle.equipmentQuantity}
                          </SMSTypography>
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4}>
                          <SMSTypography variant="subtitle1" color="text.secondary">
                            {perLabel(vehicle) ? `Per: ${perLabel(vehicle)}` : ''}
                          </SMSTypography>
                        </SMSGrid>
                      </SMSGrid>
                      <SMSGrid container spacing={1}>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Charge"
                            value={formatCurrency(vehicle.charge)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Mileage Charge"
                            value={formatMileageCharge(vehicle.mileageCharge, '-')}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Charge Mileage"
                            value={formatBool(vehicle.chargeMileage)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                          <SMSDataDisplay
                            variant="inline"
                            label="Requires Approval"
                            value={formatBool(vehicle.requiresApproval)}
                            labelFontWeight={600}
                          />
                        </SMSGrid>
                        {vehicle.requiresUtilizationRecorded === true && (
                          <SMSGrid item xs={12} sm={6} md={4} alignItems="center">
                            <SMSDataDisplay
                              variant="inline"
                              label="Utilization Recorded"
                              value={formatBool(vehicle.requiresUtilizationRecorded)}
                              labelFontWeight={600}
                            />
                          </SMSGrid>
                        )}
                      </SMSGrid>
                    </SMSStack>
                  ))}
                </SMSStack>
              </SMSCard>
            </SMSBox>
          )}
        </SMSBox>
      )}
    </SMSBox>
  );
};

export default SMSViewDetailsEquipmentSection;
