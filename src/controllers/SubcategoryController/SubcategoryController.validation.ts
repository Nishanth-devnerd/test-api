import { OfferTypeEnum } from '../../shared/enum/offer-type-enum';
import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"

export const SubcategoryListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    orderBy: Yup
        .object({
            name: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            active: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            categoryId: Yup
                .number()
        })
        .optional()
})

export const SubcategoryCreateValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Subcategory name is required"),
    categoryId: Yup
        .number()
        .required("Category is required to create subcategory"),
    attachmentId: Yup
        .number()
        .required("Attachment is required"),
    // baseOffer: Yup.object({
    //     discount: Yup
    //         .number()
    //         .required("Subcategory discount is required"),
    //     offerType: Yup
    //         .string().oneOf(Object.values(OfferTypeEnum), "Invalid offer type")
    //         .required("Offer type is required") as Yup.Schema<OfferTypeEnum>,
    //     minimumOrder: Yup
    //         .number(),
    //     maximumDiscount: Yup
    //         .number(),
    // })
    //     .required("Subcategory base offer is required")
})

export const SubcategoryUpdateValidationSchema = Yup.object({
    id: Yup
        .number(),
    name: Yup
        .string(),
    active: Yup
        .boolean(),
    attachmentId: Yup
        .number(),
    // baseOffer: Yup.object({
    //     id: Yup
    //         .string(),
    //     discount: Yup
    //         .number(),
    //     offerType: Yup
    //         .string()
    //         .oneOf(Object.values(OfferTypeEnum), "Invalid offer type") as Yup.Schema<OfferTypeEnum>,
    //     minimumOrder: Yup
    //         .number()
    //         .notRequired(),
    //     maximumDiscount: Yup
    //         .number()
    //         .notRequired(),
    // }),
})



export const subcategoryLocationUpdateValidationSchema = Yup.array().of(
    Yup.object().shape({
        locationId: Yup
            .number()
            .required("Location Id is missing"),
        // offer: Yup.object({
        //     id: Yup.string().required("Offer Id is missing"),
        //     discount: Yup
        //         .number()
        //         .typeError("Invalid type for discount")
        //         .required("Discount is missing"),
        //     offerType: Yup
        //         .string()
        //         .oneOf(Object.values(OfferTypeEnum), "Invalid offer type") as Yup.Schema<OfferTypeEnum>,
        //     minimumOrder: Yup
        //         .number()
        //         .nullable()
        //         .typeError("Invalid type for minimum order")
        //         .default(undefined),
        //     maximumDiscount: Yup
        //         .number()
        //         .nullable()
        //         .typeError("Invalid type for maximum order")
        //         .default(undefined),
        // }),
        active: Yup
            .boolean().required("Status is missing"),
    }))