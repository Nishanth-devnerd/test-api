import * as Yup from "yup"

export const SlotCreateValidationSchema = Yup.object({
    startTime: Yup
        .date()
        .required("Slot start time is required"),
    endTime: Yup
        .date()
        .required("Slot end time is required"),
    duration: Yup
        .number()
        .required("Slot division is required"),
})

export const SlotUpdateValidationSchema = Yup.object({
    date: Yup
        .date()
        .required("Slot date is required"),
    active: Yup
        .boolean()
        .required("Slot status is required"),
    id: Yup
        .number()
})