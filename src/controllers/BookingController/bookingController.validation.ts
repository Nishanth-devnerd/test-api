import * as Yup from "yup"
import { BookingStatus, WarrantyStatus } from "@prisma/client";

export const BookingListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    export: Yup
        .boolean()
        .optional(),
    // orderBy: Yup
    //     .object({
    //         name: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
    //         active: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
    //     })
    //     .optional()
    //     .test("max-keys", "You can only sort by one field at a time", value => {
    //         // Check if the object has only one key
    //         if (value && Object.keys(value).length > 1) {
    //             return false;
    //         }
    //         return true;
    //     }),
    filterBy: Yup
        .object({
            search: Yup
                .string(),
            customerId: Yup
                .number(),
            status: Yup.array().of(Yup
                .string()
                .required("Status is missing")
                .oneOf(Object.values(BookingStatus), "Invalid sort value"),
            )
        })
        .optional()
})

export const BookingCreateValidationSchema = Yup.object({
    customerId: Yup
        .number()
        .required("Customer is required"),
    addressId: Yup
        .number()
        .required("Address is required to make booking. Please add one"),
    serviceId: Yup
        .number()
        .required("Service is required"),
    isOnlinePayment: Yup
        .boolean(),
    status: Yup
        .string()
        .oneOf(Object.values(BookingStatus), "Invalid status"),
    taskId: Yup
        .number()
        .required("Task is required"),
    slotId: Yup
        .number()
        .required("Slot is required"),
    couponId: Yup
        .number(),
})

export const BookingUpdateValidationSchema = Yup.object({
    status: Yup
        .string()
        .oneOf(Object.values(BookingStatus), "Invalid booking status") as Yup.Schema<BookingStatus>,
    isOnlinePayment: Yup
        .boolean()
})

export const WarrantyRequestValidationSchema = Yup.object({
    reason: Yup
        .string()
        .required("Please select the reason"),
    description: Yup
        .string(),
    attachments: Yup.array().of(Yup.object({
        id: Yup.number()
            .required("Found an invalid attachment. Please remove it and try again"),
    }))
        .required("Please attach images")
        .min(1, "Please attach images")
})

export const WarrantyActionValidationSchema = Yup.object({
    status: Yup
        .string()
        .required("Approval or rejection is required")
        .oneOf(Object.values(WarrantyStatus), "Invalid booking status") as Yup.Schema<WarrantyStatus>
})
