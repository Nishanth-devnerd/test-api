import * as Yup from "yup"
import { OfferTypeEnum } from "../../shared/enum/offer-type-enum"
import { PaymentTypes } from "@prisma/client"
import { SortEnum } from "../../shared/enum/sort-enum";

export const PaymentListingParamsValidationSchema = Yup.object({
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
            amount: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            createdAt: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            type: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            transactionStatus: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
                .string(),
            type: Yup
                .string()
                .oneOf(Object.values(PaymentTypes), "Invalid payment type value"),
            customerId: Yup
                .number()
        })
        .optional()
})


export const RefundCreateValidationSchema = Yup.object({
    amount: Yup
        .number()
        .required("Refund amount is required"),
})

