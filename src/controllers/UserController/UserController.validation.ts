import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"

export const UserListingParamsValidationSchema = Yup.object({
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
            mail: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            mobile: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            lastActivityOn: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
            memberSince: Yup.mixed().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            // .min(3, "Search value should atleast have 3 characters"),
            lastActivityOn: Yup
                .array()
                .of(Yup
                    .string()
                    .typeError("Invalid filter for last activity")
                    .required("Invalid filter for last activity")
                )
                .length(2, "Invalid filter for last activity"),
            memberSince: Yup
                .array()
                .of(Yup
                    .string()
                    .typeError("Invalid filter for member since")
                    .required("Invalid filter for member since")
                )
                .length(2, "Invalid filter for member since"),
            // noOfBookings: Yup
            //     .array()
            //     .of(
            //         Yup
            //             .number()
            //             .typeError("Invalid filter for number of bookings")
            //             .required("Invalid filter for number of bookings")
            //     )
            //     .length(2, "Invalid filter for number of bookings"),
        })
        .optional()
})