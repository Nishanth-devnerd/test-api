import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { ErrorModel } from "../../models/ErrorModel";
import { CouponCreateValidationSchema, CouponListingParamsValidationSchema, CouponUpdateValidationSchema } from "./CouponController.validation";
import CouponModel from "../../models/CouponModel";
import { deserialize, serialize } from "serializr";
import { CouponSerializer, CouponFilterSerializer, CouponOrderSerializer, CustomerCouponSerializer } from "../../serializers/CouponSerializer";
import { removeFalsyKeys } from "../../shared/utils/removeFalsyKeys";
import { RoleEnum } from "../../shared/enum/role-enum";
import { generateExcel, uploadToS3 } from "../../plugins/export";

const CouponController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await CouponListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(CouponOrderSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(CouponFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true) as CouponOrderSerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as CouponFilterSerializer

            if (serializedSortKeys)
                params.orderBy = { offer: serializedSortKeys } as any
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { coupons, meta } = await new CouponModel().index(params as any)

            if (params.export && request.user?.id && request.user.role.name === RoleEnum.ADMIN) {
                const excelBuffer = await generateExcel("coupon", coupons);
                const url = await uploadToS3(excelBuffer, "coupon");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            response
                .status(200)
                .json({
                    coupons: deserialize(request.user?.id && request.user.role.name === RoleEnum.ADMIN
                        ? CouponSerializer
                        : CustomerCouponSerializer,
                        coupons), meta
                })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await CouponCreateValidationSchema.validate(request.body[BaseKey.COUPON], { stripUnknown: true, abortEarly: false })
            const coupon = await new CouponModel().create(body)
            response
                .status(200)
                .json({ coupon })

        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const couponId = Number(request.params["couponId"])

            if (!couponId || isNaN(couponId)) throw new ErrorModel({ statusCode: 422, message: "Coupon id missing!", name: "Invalid request" })

            const body = await CouponUpdateValidationSchema.validate(request.body[BaseKey.COUPON], { stripUnknown: true, abortEarly: false })

            const coupon = await new CouponModel().update(couponId, body as any)
            response
                .status(200)
                .json({ coupon })

        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        create,
        update,
    }
}

export default CouponController