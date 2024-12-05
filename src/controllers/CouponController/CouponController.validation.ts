import * as Yup from "yup"
import { OfferTypeEnum } from "../../shared/enum/offer-type-enum"
import { SortEnum } from "../../shared/enum/sort-enum";

export const CouponListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    export: Yup
        .boolean()
        .optional(),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    orderBy: Yup
        .object({
            title: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            active: Yup
                .boolean(),
            isExpired: Yup
                .boolean(),
        })
        .optional()
})

export const CouponCreateValidationSchema = Yup.object({
    offer: Yup.object().shape({
        title: Yup
            .string()
            .required("Coupon code is required"),
        description: Yup
            .string(),
        discount: Yup
            .number()
            .typeError("Invalid type for discount")
            .required("Discount is missing"),
        offerType: Yup
            .string()
            .oneOf(Object.values(OfferTypeEnum), "Invalid offer type") as Yup.Schema<OfferTypeEnum>,
        minimumOrder: Yup
            .number()
            .nullable()
            .typeError("Invalid type for minimum order")
            .default(undefined),
        maximumDiscount: Yup
            .number()
            .nullable()
            .typeError("Invalid type for maximum order")
            .default(undefined),
        validTill: Yup
            .date()
            .nullable()
            .typeError("Invalid type for validity")
            .default(undefined),
    })
})

export const CouponUpdateValidationSchema = Yup.object({
    active: Yup
        .boolean(),
    offer: Yup.object().shape({
        id: Yup
            .number()
            .required("Offer id is missing"),
        title: Yup
            .string(),
        description: Yup
            .string()
            .nullable(),
        discount: Yup
            .number()
            .typeError("Invalid type for discount"),
        offerType: Yup
            .string()
            .oneOf(Object.values(OfferTypeEnum), "Invalid offer type") as Yup.Schema<OfferTypeEnum>,
        minimumOrder: Yup
            .number()
            .nullable()
            .typeError("Invalid type for minimum order")
            .default(undefined),
        maximumDiscount: Yup
            .number()
            .nullable()
            .typeError("Invalid type for maximum order")
            .default(undefined),
        validTill: Yup
            .date()
            .nullable()
            .typeError("Invalid type for validity")
            .default(undefined),
    })
})
