import { SortEnum } from '../../shared/enum/sort-enum';
import * as Yup from "yup"

export const EnquiryValidationSchema = Yup.object({
    name: Yup
        .string()
        .min(3, "Name should be minimum 3 letters")
        .max(20, "Name should be maximum 20 letters")
        .required("Name is required"),
    email: Yup
        .string()
        .email("Email should be valid"),
    mobile: Yup
        .string()
        .required("Phone number is required"),
    query: Yup
        .string()
        .max(100, "Name should be maximum 100 letters")
})

export const EnquiryUpdateValidationSchema = Yup.object({
    isContacted: Yup
        .boolean()
        .required()
})
