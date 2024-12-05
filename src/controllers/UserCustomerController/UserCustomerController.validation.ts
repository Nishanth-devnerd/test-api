import * as Yup from "yup"
import { GeolocationUpdateValidationSchema, GeolocationValidationSchema } from "../LocationController/LocationController.validation"

export const CustomerAddressCreateValidationSchema = Yup.object({
    // name: Yup
    //     .string()
    //     .required("Name is required"),
    // mobile: Yup
    //     .string()
    //     .required("Phone number is required"),
    // mail: Yup
    //     .string()
    //     .default(null)
    //     .nullable()
    //     .notRequired()
    //     .transform((value, originalValue) => {
    //         return originalValue?.trim() === '' ? null : value;
    //     })
    //     .email("Email should be valid"),
    addressType: Yup
        .string(),
    landmark: Yup
        .string()
        .default(null)
        .nullable()
        .notRequired()
        .transform((value, originalValue) => {
            return originalValue?.trim() === '' ? null : value;
        }),
    geolocation: GeolocationValidationSchema
        .required("Geolocation is required"),
    userId: Yup
        .number()
})

export const CustomerAddressUpdateValidationSchema = Yup.object({
    addressType: Yup
        .string(),
    primaryAddress: Yup
        .boolean(),
    landmark: Yup
        .string()
        .default(null)
        .notRequired()
        .transform((value, originalValue) => {
            return originalValue?.trim() === '' ? null : value;
        }),
    geolocation: GeolocationUpdateValidationSchema
})



export const CustomerUpdateValidationSchema = Yup.object({
    name: Yup
        .string()
        .min(3, "Name should atleast have 3 characters"),
    mobile: Yup
        .string(),
    active: Yup
        .boolean(),
    mail: Yup
        .string()
        .default(null)
        .notRequired()
        .transform((value, originalValue) => {
            return originalValue?.trim() === '' ? null : value;
        })
        .email("Email should be valid"),
})