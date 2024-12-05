import { NotificationType } from '@prisma/client';
import { SortEnum } from './../../shared/enum/sort-enum';
import * as Yup from "yup"

export const NotificationListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    orderBy: Yup
        .object({
            id: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            subject: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            // count: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            createdAt: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
                .oneOf(Object.values(NotificationType), "Invalid notification type")
                .required("Notification type is required")
            // .min(3, "Search value should atleast have 3 characters"),
            // lastActivityOn: Yup
            //     .array()
            //     .of(Yup
            //         .string()
            //         .typeError("Invalid filter for last activity")
            //         .required("Invalid filter for last activity")
            //     )
            //     .length(2, "Invalid filter for last activity"),
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
})


export const NotificationValidationSchema = Yup.object({
    subject: Yup
        .string()
        .required("Subject is required"),
    type: Yup
        .string()
        .oneOf(Object.values(NotificationType), "Invalid notification type")
        .required("Notification type is required"),
    content: Yup
        .string()
        .required("Content is required"),
    userIds: Yup.array().of(Yup
        .number()
        .required("Customer id is required"),
    )
        .required("Customers are required"),
})