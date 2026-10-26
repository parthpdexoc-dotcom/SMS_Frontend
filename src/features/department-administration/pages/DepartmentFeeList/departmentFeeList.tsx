import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { useUrlFilters } from "@/hooks/useUrlFilters";
import { usePagination } from "@/hooks/usePagination";
import { useMasterDataListStatusPagedParams } from "@/hooks/useMasterDataListStatusPagedParams";
import { useDebounce } from "@/hooks/useDebounceSearch";
import { DEPARTMENT_FEE } from "@/constants/strings";
import { DepartmentFeeResponse, FeeType, ReimburseTo } from "@/types/departmentFeeType";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
	fetchDepartmentFees,
	removeDepartmentFee,
	searchDepartmentFeesThunk,
} from "@/store/slices/departmentFeeSlice";
import { SMSDepartmentFeeForm } from "@/components/smsmolecules/SMSDepartmentFeeForm";
import { SMSMasterDataShortLongStatusList } from '@/components/smsorganisms';
import { formatCurrency } from '@/utils/formatters';

const BASE = "/employee/department-fee";

export interface DepartmentFeeListProps {
	className?: string;
}

export const DepartmentFeeList: React.FC<DepartmentFeeListProps> = ({
	className = "",
}) => {
	const dispatch = useAppDispatch();
	const { departmentFees, isLoading, totalItems: totalItemsFromStore } = useAppSelector(
		(state) => state.departmentFee,
	);
	const pagination = usePagination();
	const { statusFilter, handleStatusFilterChange, isActiveParam } =
		useMasterDataListStatusPagedParams(pagination);
	const location = useLocation();
	const navigate = useNavigate();
	const { id: editId } = useParams<{ id?: string }>();
	const [urlFilters, , setSearchFilters] = useUrlFilters(["search"]);
	const searchFromUrl = urlFilters.search ?? "";
	const [localSearch, setLocalSearch] = useState(searchFromUrl);
	const debouncedSearch = useDebounce(localSearch, 500);

	const refetchList = useCallback(() => {
		const searchTerm = debouncedSearch.trim();
		const params = {
			page: pagination.currentPage,
			pageSize: pagination.pageSize,
			...(isActiveParam !== undefined ? { isActive: isActiveParam } : {}),
			...(searchTerm ? { searchTerm } : {}),
		};
		if (searchTerm.length > 0) {
			dispatch(searchDepartmentFeesThunk(params));
		} else {
			dispatch(fetchDepartmentFees(params));
		}
	}, [dispatch, pagination.currentPage, pagination.pageSize, isActiveParam, debouncedSearch]);

	useEffect(() => {
		refetchList();
	}, [refetchList]);

	useEffect(() => {
		pagination.setTotalItems(totalItemsFromStore);
	}, [totalItemsFromStore, pagination.setTotalItems]);

	useEffect(() => {
		setLocalSearch(searchFromUrl);
	}, [searchFromUrl]);

	useEffect(() => {
		if (debouncedSearch !== searchFromUrl) {
			pagination.goToFirstPage();
			setSearchFilters({ search: debouncedSearch === '' ? undefined : debouncedSearch });
		}
	}, [debouncedSearch, searchFromUrl, pagination, setSearchFilters]);

	const openModal = useMemo((): "add" | string | null => {
		if (location.pathname === `${BASE}/add`) return "add";
		if (editId && location.pathname.startsWith(`${BASE}/edit/`)) return editId;
		return null;
	}, [location.pathname, editId]);

	// Helper function to get Fee Type label
	const getFeeTypeLabel = (feeType: FeeType): string => {
		const feeTypeOption = DEPARTMENT_FEE.ENUMS.FEE_TYPE.find(
			(opt) => opt.value === String(feeType)
		);
		return feeTypeOption?.label || `Fee Type ${feeType}`;
	};

	// Helper function to get Reimburse To label
	const getReimburseToLabel = (reimburseTo: ReimburseTo): string => {
		const reimburseOption = DEPARTMENT_FEE.ENUMS.REIMBURSE_TO.find(
			(opt) => opt.value === String(reimburseTo)
		);
		return reimburseOption?.label || `Option ${reimburseTo}`;
	};

	// Extra columns configuration
	const extraColumns = useMemo(
		() => [
			{
				key: "feeType",
				label: DEPARTMENT_FEE.TABLE.COLUMNS.FEE_TYPE,
				render: (_value: any, row: DepartmentFeeResponse) =>
					getFeeTypeLabel(row.feeType),
			},
			{
				key: "defaultFee",
				label: DEPARTMENT_FEE.TABLE.COLUMNS.DEFAULT_FEE,
				render: (_value: any, row: DepartmentFeeResponse) =>
					formatCurrency(row.defaultFee),
			},
			{
				key: "additionalFee",
				label: DEPARTMENT_FEE.TABLE.COLUMNS.ADDITIONAL_FEE,
				render: (_value: any, row: DepartmentFeeResponse) =>
					formatCurrency(row.additionalFee),
			},
			{
				key: "reimburseTo",
				label: DEPARTMENT_FEE.TABLE.COLUMNS.REIMBURSE_TO,
				render: (_value: any, row: DepartmentFeeResponse) =>
					getReimburseToLabel(row.reimburseTo),
			},
		],
		[]
	);

	return (
		<div className="department-fee-list-wrapper">
			<SMSMasterDataShortLongStatusList<DepartmentFeeResponse>
				className={`department-fee-list ${className}`}
				getId={(r) => r.feeId}
				openModal={openModal}
				onOpenAdd={() => navigate(`${BASE}/add`)}
				onOpenEdit={(id) => navigate(`${BASE}/edit/${id}`)}
				onModalClose={() => navigate(BASE)}
			strings={{
				TITLE: DEPARTMENT_FEE.TITLE,
				EDIT_TITLE: DEPARTMENT_FEE.EDIT_TITLE,
				TABLE: {
					TITLE: DEPARTMENT_FEE.TABLE.TITLE,
					NO_DATA: DEPARTMENT_FEE.TABLE.NO_DATA,
					FILTERS: {
						ACTIVE: DEPARTMENT_FEE.TABLE.FILTERS.ACTIVE,
						INACTIVE: DEPARTMENT_FEE.TABLE.FILTERS.INACTIVE,
					},
					COLUMNS: {
						TITLE: DEPARTMENT_FEE.TABLE.COLUMNS.TITLE,
						DESCRIPTION: DEPARTMENT_FEE.TABLE.COLUMNS.DESCRIPTION,
						STATUS: DEPARTMENT_FEE.TABLE.COLUMNS.STATUS,
						CREATED_BY: DEPARTMENT_FEE.TABLE.COLUMNS.CREATED_BY,
						EDITED_BY: DEPARTMENT_FEE.TABLE.COLUMNS.EDITED_BY,
						ACTION: DEPARTMENT_FEE.TABLE.COLUMNS.ACTION,
					},
				},
				BUTTON: {
					ADD_NEW: DEPARTMENT_FEE.BUTTON.ADD_NEW,
					EDIT: DEPARTMENT_FEE.BUTTON.EDIT,
					DELETE: DEPARTMENT_FEE.BUTTON.DELETE,
				},
				CONFIRM: {
					DELETE_TITLE: DEPARTMENT_FEE.CONFIRM.DELETE_TITLE,
					DELETE_MESSAGE: DEPARTMENT_FEE.CONFIRM.DELETE_MESSAGE,
					DELETE_CONFIRM: DEPARTMENT_FEE.CONFIRM.DELETE_CONFIRM,
					DELETE_CANCEL: DEPARTMENT_FEE.CONFIRM.DELETE_CANCEL,
				},
			}}
			controlledStatusFilter={statusFilter}
			onControlledStatusFilterChange={handleStatusFilterChange}
			items={departmentFees}
			loading={isLoading}
			onRefresh={refetchList}
			serverPagination={{
				totalItems: pagination.totalItems,
				currentPage: pagination.currentPage,
				pageSize: pagination.pageSize,
				onPageChange: (page) => pagination.goToPage(page),
				onPageSizeChange: (newPageSize) => {
					pagination.setPageSize(newPageSize);
					pagination.goToFirstPage();
				},
			}}
			onDelete={async (row) => {
				await dispatch(
					removeDepartmentFee({
						id: row.feeId,
						name:
							(row.feeShort ?? row.feeLong ?? "").trim() || "this department fee",
					})
				).unwrap();
			}}
			FormComponent={SMSDepartmentFeeForm}
			getShort={(r) => r.feeShort}
			getLong={(r) => r.feeLong ?? ""}
			getStatus={(r) => Boolean(r.isActive ?? true)}
			getCreatedBy={(r) => r.createdBy}
			getCreatedDate={(r) => r.createdDate}
			getEditedBy={(r) => r.editedBy}
			getEditedDate={(r) => r.editedDate}
			extraColumns={extraColumns}
			showAuditColumns={false}
			searchValue={localSearch}
			onSearchChange={setLocalSearch}
		/>
		</div>
	);
};
