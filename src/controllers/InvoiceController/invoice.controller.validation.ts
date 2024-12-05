import * as Yup from 'yup';
import { SortEnum } from '../../shared/enum/sort-enum';

export const InvoiceListingParamsValidationSchema = Yup.object({
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
            date: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
            refNumber: Yup.string().oneOf(Object.values(SortEnum), "Invalid sort value"),
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
            invoiceRange: Yup.array().of(Yup
                .string()
                .typeError("Invalid filter for invoice date")
                .required("Invalid filter for invoice date")
            ).length(2, "Date range invalid")
        })
        .optional()
})


export const InvoiceCreateValidationSchema = Yup.object().shape({
    refNumber: Yup.string().required('Invoice number is required'),
    date: Yup.date().required('Date is required'),
    bookingId: Yup.number().required('Booking ID is required'),

    billingAttention: Yup.string().required('Billing attention is required'),
    billingAddress: Yup.string().required('Billing address is required'),
    // billingStreet2: Yup.string().required('Billing street is required'),
    // billingStateCode: Yup.string().required('Billing state code is required'),
    billingCity: Yup.string().required('Billing city is required'),
    billingState: Yup.string().required('Billing state is required'),
    billingZip: Yup.number().integer().positive().required('Billing zip is required'),
    billingCountry: Yup.string().required('Billing country is required'),
    // billingFax: Yup.number().integer().positive().required('Billing fax is required'),
    billingPhone: Yup.string().required('Billing phone is required'),
    shippingAttention: Yup.string().required('Shipping attention is required'),
    shippingAddress: Yup.string().required('Shipping address is required'),
    // shippingStreet2: Yup.string().required('Shipping street is required'),
    // shippingStateCode: Yup.string().required('Shipping state code is required'),
    shippingCity: Yup.string().required('Shipping city is required'),
    shippingState: Yup.string().required('Shipping state is required'),
    shippingZip: Yup.number().integer().positive().required('Shipping zip is required'),
    shippingCountry: Yup.string().required('Shipping country is required'),
    // shippingFax: Yup.number().integer().positive().required('Shipping fax is required'),
    shippingPhone: Yup.string().required('Shipping phone is required'),
});

export const InvoiceUpdateValidationSchema = Yup.object().shape({
    refNumber: Yup.string(),
    date: Yup.date(),

    billingAttention: Yup.string(),
    billingAddress: Yup.string(),
    billingCity: Yup.string(),
    billingState: Yup.string(),
    billingZip: Yup.number().integer().positive(),
    billingCountry: Yup.string(),
    billingPhone: Yup.string(),
    shippingAttention: Yup.string(),
    shippingAddress: Yup.string(),
    shippingCity: Yup.string(),
    shippingState: Yup.string(),
    shippingZip: Yup.number().integer().positive(),
    shippingCountry: Yup.string(),
    shippingPhone: Yup.string(),
});
