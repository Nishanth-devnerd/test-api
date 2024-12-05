import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"

export const LocationListingParamsValidationSchema = Yup.object({
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
            radius: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
                .boolean()
        })
        .optional()
})

export const GeolocationValidationSchema = Yup.object({
    id: Yup
        .number(),
    latitude: Yup
        .number()
        .required("Latitude is required"),
    longitude: Yup
        .number()
        .required("Longitude is required"),
    city: Yup
        .string()
        .required("City is required"),
    state: Yup
        .string()
        .required("State is required"),
    pincode: Yup
        .string()
        .required("Pincode is required"),
    addressLine: Yup
        .string()
})

export const LocationValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Name is required"),
    radius: Yup
        .number()
        .required("Radius is required"),
    active: Yup
        .boolean(),
    geolocation: GeolocationValidationSchema
        .required("Geolocation is required")
})

export const GeolocationUpdateValidationSchema = Yup.object({
    id: Yup
        .number(),
    latitude: Yup
        .number(),
    longitude: Yup
        .number(),
    city: Yup
        .string(),
    state: Yup
        .string(),
    pincode: Yup
        .string(),
    addressLine: Yup
        .string()
})

export const LocationUpdateValidationSchema = Yup.object({
    name: Yup
        .string(),
    radius: Yup
        .number(),
    active: Yup
        .boolean(),
    geolocation: GeolocationUpdateValidationSchema
})