import * as Yup from "yup"

export const BookingListingParamsValidationSchema = Yup.object({
    year: Yup
        .string()
        .min(4, "Year should be valid")
        .max(4, "Year should be valid")
})

