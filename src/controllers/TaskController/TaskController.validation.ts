import * as Yup from "yup"
import { OfferTypeEnum } from "../../shared/enum/offer-type-enum"

export const TaskCreateValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Task title is required"),
    serviceId: Yup
        .number()
        .required("Service id is required"),
    duration: Yup
        .number()
        .required("Duration is required"),
    baseCost: Yup
        .number()
        .required("Cost is required"),
})

export const TaskUpdateValidationSchema = Yup.object({
    id: Yup
        .number()
        .required("Task id is required"),
    name: Yup
        .string(),
    duration: Yup
        .number(),
    baseCost: Yup
        .number()
})


export const taskLocationUpdateValidationSchema = Yup.array().of(
    Yup.object().shape({
        locationId: Yup
            .number()
            .required("Location Id is missing"),
        offer: Yup.object({
            id: Yup.number().required("Offer Id is missing"),
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
        }),
        active: Yup
            .boolean().required("Status is missing"),
        cost: Yup
            .number().required("Cost is missing"),
    }))