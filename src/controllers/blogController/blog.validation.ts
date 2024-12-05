import { SortEnum } from '../../shared/enum/sort-enum';
import * as Yup from "yup"

export const BlogListingParamsValidationSchema = Yup.object({
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
                .string()
                .min(3, "Search value should atleast have 3 characters"),
            // lastActivityOn: Yup
            //     .array()
            //     .of(Yup
            //         .string()
            //         .typeError("Invalid filter for last activity")
            //         .required("Invalid filter for last activity")
            //     )
            //     .length(2, "Invalid filter for last activity"),
            tagIds: Yup.array().of(Yup.number().required("Invalid blog category")),
            isPublished: Yup
                .boolean()
                .required("Blog status is required")
        })
})

export const BlogTagParamsValidationSchema = Yup.object({
    search: Yup
        .string()
        .min(3, "Search value should atleast have 3 characters"),
})

export const BlogValidationSchema = Yup.object({
    title: Yup
        .string()
        .required("Title is required"),
    content: Yup
        .string()
        .required("Content is required"),
    authorName: Yup
        .string()
        .required("Author name is required"),
    serviceId: Yup
        .number()
        .required("Service is required"),
    slug: Yup
        .string()
        .required("Slug is required"),
    coverPictureId: Yup
        .number()
        .required("Cover picture is required"),
    isPublished: Yup
        .boolean(),
    tagNames: Yup.array().of(Yup
        .string()
        .required("Tag is required"),
    ),
    tagIds: Yup.array().of(Yup
        .number()
        .required("Tag is required"),
    )
})

export const BlogUpdateValidationSchema = Yup.object({
    title: Yup
        .string(),
    content: Yup
        .string(),
    authorName: Yup
        .string(),
    serviceId: Yup
        .number(),
    slug: Yup
        .string(),
    coverPictureId: Yup
        .number(),
    isPublished: Yup
        .boolean(),
    tagNames: Yup.array().of(Yup
        .string()
        .required("Tag is required"),
    ),
    tagIds: Yup.array().of(Yup
        .number()
        .required("Tag is required"),
    )
})