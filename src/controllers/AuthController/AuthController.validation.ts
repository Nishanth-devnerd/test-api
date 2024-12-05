import * as Yup from "yup"

export const RegisterationValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Name is required")
        .min(3, "Name should atleast have 3 characters"),
    mobile: Yup
        .string()
        .required("Mobile number is required"),
    // password: Yup
    //     .string()
    //     .required("Password is required to create admin"),
    mail: Yup
        .string()
        // .required()
        .default(null)
        .nullable()
        .notRequired()
        .transform((value, originalValue) => {
            return originalValue?.trim() === '' ? null : value;
        })
        .email("Email should be valid")
})

export const AdminRegisterationValidationSchema = Yup.object({
    name: Yup
        .string()
        .required("Name is required")
        .min(3, "Name should atleast have 3 characters"),
    mobile: Yup
        .string()
        .required("Mobile number is required"),
    password: Yup
        .string()
        .required("Password is required to create admin"),
    mail: Yup
        .string()
        .required()
        .email("Email should be valid")
})

export const LoginValidationSchema = Yup.object({
    otp: Yup
        .string()
        .min(4)
        .max(4)
        .required("OTP is required"),
    mobile: Yup
        .string()
        .required("Mobile number is required"),
})

export const GetOTPValidationSchema = Yup.object({
    mobile: Yup
        .string()
        .required("Mobile number is required"),
})

export const AdminLoginValidationSchema = Yup.object({
    mail: Yup
        .string()
        .required("Email is required")
        .email("Email should be valid"),
    password: Yup
        .string()
        .required("Password is required"),
})