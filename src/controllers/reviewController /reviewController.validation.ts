import * as Yup from "yup"
import { ReviewStatus } from "@prisma/client"
import { SortEnum } from "../../shared/enum/sort-enum";


export const ReviewListingParamsValidationSchema = Yup.object({
    page: Yup
        .number()
        .typeError("Page number should be valid"),
    limit: Yup
        .number()
        .typeError("Limit should be valid"),
    orderBy: Yup
        .object({
            service: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            customer: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            rating: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            status: Yup.string().required().oneOf(Object.values(ReviewStatus), "Invalid status value"),
        })
        .required()
})

export const ReviewCreateValidationSchema = Yup.object({
    rating: Yup
        .number()
        .min(1, "Rating should be valid")
        .max(5, "Rating should be valid")
        .positive("Rating should be valid")
        .required("Rating is required"),
    reviewComment: Yup
        .string(),
    serviceId: Yup
        .number()
        .required("Service is missing"),
})

export const ReviewUpdateValidationSchema = Yup.object({
    rating: Yup
        .number()
        .min(1, "Rating should be valid")
        .max(5, "Rating should be valid")
        .positive("Rating should be valid"),
    reviewComment: Yup
        .string()
})

export const ReviewStatusUpdateValidationSchema = Yup.object({
    status: Yup
        .string()
        .required()
        .oneOf(Object.values(ReviewStatus), "Invalid status"),
})
