import { AttachmentTypes } from "@prisma/client"
import * as Yup from "yup"

export const AttachmentValidationSchema = Yup.object({
    url: Yup
        .string()
        .required("Attachment url is required"),
    redirectUrl: Yup
        .string(),
    name: Yup
        .string(),
    type: Yup
        .string()
        .oneOf(Object.values(AttachmentTypes), "Invalid attachment type")
        .required("Attachment type is required"),
})

export const PresignValidationSchema = Yup.object({
    fileName: Yup
        .string()
        .required("First name is required"),
    contentType: Yup
        .string()
        .required("Content type is required")
})