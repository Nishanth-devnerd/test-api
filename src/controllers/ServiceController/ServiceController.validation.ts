import { WarrantyPeriodType } from '@prisma/client';
import { OfferTypeEnum } from '../../shared/enum/offer-type-enum';
import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"
import { TaskCreateValidationSchema, TaskUpdateValidationSchema } from '../TaskController/TaskController.validation';

export const ServiceListingParamsValidationSchema = Yup.object({
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
            name: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            active: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            categoryName: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            subcategoryName: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            categoryIds: Yup
                .array()
                .of(Yup.number()),
            subcategoryIds: Yup
                .array()
                .of(Yup.number()),
        })
        .optional(),
})


export const ServiceCreateValidationSchema = Yup.object({
    categoryId: Yup
        .number()
        .required("Category is required"),
    subcategoryId: Yup
        .number()
        .required("Subcategory is required"),
    name: Yup
        .string()
        .required("Service name is required"),
    description: Yup
        .string()
        .required("Service description is required"),
    bookBeforeInDays: Yup
        .number()
        .required("Occurence is required"),
    isAvailableEverywhere: Yup
        .boolean(),
    guarentee: Yup
        .string()
        .required("Guarentee is required"),
    disclaimer: Yup
        .string()
        .required("Disclaimer is required"),
    warrantyPeriod: Yup
        .number()
        .required("Warranty period is required"),
    warrantyPeriodType: Yup
        .string()
        .required("Warranty period type is required")
        .oneOf(Object.values(WarrantyPeriodType), "Invalid warramty period") as Yup.Schema<WarrantyPeriodType>,
    activeFrom: Yup
        .date()
        .required("Service availability is required"),
    activeTill: Yup
        .date(),
    baseOffer: Yup.object({
        discount: Yup
            .number()
            .required("Service discount is required"),
        offerType: Yup
            .string().oneOf(Object.values(OfferTypeEnum), "Invalid offer type")
            .required("Offer type is required") as Yup.Schema<OfferTypeEnum>,
        minimumOrder: Yup
            .number()
            .nullable()
            .transform((value, originalValue) => {
                if (originalValue === null) {
                    return 0;
                }
                return value;
            }),
        maximumDiscount: Yup
            .number()
            .nullable()
            .transform((value, originalValue) => {
                if (originalValue === null) {
                    return 0;
                }
                return value;
            }),
    }).required("Service base offer is required"),
    inspectionTask: TaskCreateValidationSchema.shape({
        serviceId: Yup.number()
            .optional()
    })
})

export const ServiceUpdateValidationSchema = Yup.object({
    id: Yup
        .number(),
    categoryId: Yup
        .number(),
    subcategoryId: Yup
        .number(),
    name: Yup
        .string(),
    description: Yup
        .string(),
    bookBeforeInDays: Yup
        .number(),
    guarentee: Yup
        .string(),
    disclaimer: Yup
        .string(),
    active: Yup
        .boolean(),
    activeFrom: Yup
        .date(),
    activeTill: Yup
        .date()
        .nullable()
        .transform((value, originalValue) => {
            return originalValue && value;
        }),
    warrantyPeriodType: Yup
        .string()
        .oneOf(Object.values(WarrantyPeriodType), "Invalid warramty period") as Yup.Schema<WarrantyPeriodType>,
    warrantyPeriod: Yup
        .number(),
    baseOffer: Yup.object({
        id: Yup
            .string(),
        discount: Yup
            .number(),
        offerType: Yup
            .string()
            .oneOf(Object.values(OfferTypeEnum), "Invalid offer type") as Yup.Schema<OfferTypeEnum>,
        minimumOrder: Yup
            .number()
            .notRequired(),
        maximumDiscount: Yup
            .number()
            .notRequired(),
    }),
    faqs: Yup.array().of(Yup.object({
        id: Yup
            .number()
            .required("FAQ id is required"),
        title: Yup
            .string(),
        description: Yup
            .string(),
    })),
    tasks: Yup.array().of(Yup.object({
        id: Yup
            .number()
            .required("Task id is required"),
        name: Yup
            .string(),
        duration: Yup
            .number(),
        baseCost: Yup
            .number(),
    })),
    inspectionTask: TaskUpdateValidationSchema
})

export const ServiceAttachmentValidationSchema = Yup.object({
    attachmentId: Yup
        .number()
        .required("Attachment Id is missing")
})

export const ServiceLocationUpdateValidationSchema = Yup.array().of(
    Yup.object().shape({
        locationId: Yup
            .number()
            .required("Location Id is missing"),
        offer: Yup.object({
            id: Yup.string().required("Offer Id is missing"),
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
        }),
        active: Yup
            .boolean().required("Status is missing"),
    }))