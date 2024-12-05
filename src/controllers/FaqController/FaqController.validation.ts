import * as Yup from "yup"

export const FaqCreateValidationSchema = Yup.object({
    title: Yup
        .string()
        .required("Faq title is required"),
    serviceId: Yup
        .number()
        .required("Service id is required"),
    description: Yup
        .string()
        .required("Faq description is required"),
})

export const FaqUpdateValidationSchema = Yup.array().of(Yup.object({
    id: Yup
        .number()
        .required("Faq id is required"),
    title: Yup
        .string(),
    description: Yup
        .string()
}))
