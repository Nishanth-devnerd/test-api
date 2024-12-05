import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"

export const EmployeeListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    export: Yup
        .boolean()
        .optional(),
    orderBy: Yup
        .object({
            name: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            mobile: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            employeeSince: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            blocked: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
        })
        .optional()
        .test("max-keys", "You can only sort by one field at a time", value => {
            // Check if the object has only one key
            if (value && Object.keys(value).length > 1) {
                return false;
            }
            return true;
        }),
    filterBy: Yup
        .object({
            search: Yup
                .string()
                .min(3, "Search value should atleast have 3 characters"),
            blocked: Yup
                .boolean()
        })
        .optional()
})

export const EmployeeMetaListingParamsValidationSchema = Yup.object({
    search: Yup
        .string(),
})

export const EmployeeCreateValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Employee name is required"),
    mobile: Yup
        .string()
        .required("Mobile number is required"),
})

export const EmployeeUpdateValidationSchema = Yup.object({
    name: Yup
        .string(),
    mobile: Yup
        .string(),
    blocked: Yup
        .boolean(),
    blockedReason: Yup
        .string()
        .nullable()
})