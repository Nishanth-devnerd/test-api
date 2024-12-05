import { EmployeeSerializer, EmployeeFilterSerializer } from './../../serializers/EmployeeSerializer';
import { NextFunction, Response } from "express";
import { prisma } from "../../..";
import EmployeeModel from "../../models/EmployeeModel";
import Request from "../../shared/interfaces/Request";
import { EmployeeCreateValidationSchema, EmployeeListingParamsValidationSchema, EmployeeMetaListingParamsValidationSchema, EmployeeUpdateValidationSchema } from "./EmployeeController.validation";
import { removeFalsyKeys } from '../../shared/utils/removeFalsyKeys';
import { deserialize, serialize } from 'serializr';
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { ErrorModel } from '../../models/ErrorModel';
import { generateExcel, uploadToS3 } from '../../plugins/export';

const EmployeeController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await EmployeeListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const orderBy = serialize(EmployeeSerializer, { ...params?.orderBy } as unknown)

            const filterBy = serialize(EmployeeFilterSerializer, { ...params?.filterBy } as unknown)

            const serializedSortKeys = removeFalsyKeys(orderBy, true) as EmployeeSerializer

            const serializedFilterKeys = removeFalsyKeys(filterBy, true) as EmployeeFilterSerializer

            if (serializedSortKeys)
                params.orderBy = serializedSortKeys
            else
                delete params?.orderBy

            if (serializedFilterKeys)
                params.filterBy = serializedFilterKeys
            else
                delete params?.filterBy

            const { employees, meta } = await new EmployeeModel(prisma.employee).index(params as any)

            if (params.export) {
                const excelBuffer = await generateExcel("employee", employees);
                const url = await uploadToS3(excelBuffer, "employee");
                return response
                    .status(200)
                    .json({
                        url
                    })
            }
            const serializedMeta = { ...meta }
            if (meta.orderBy)
                serializedMeta.orderBy = deserialize(EmployeeSerializer, meta.orderBy) as any
            if (meta.filterBy)
                serializedMeta.filterBy = deserialize(EmployeeFilterSerializer, meta.filterBy) as any

            response
                .status(200)
                .json({ employees: deserialize(EmployeeSerializer, employees), meta: serializedMeta })
        } catch (error) {
            next(error)
        }
    }

    const metaIndex = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const params = await EmployeeMetaListingParamsValidationSchema.validate(request.query, { stripUnknown: true })

            const employees = await new EmployeeModel(prisma.employee).metaIndex(params.search)

            response
                .status(200)
                .json({ employees: deserialize(EmployeeSerializer, employees) })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await EmployeeCreateValidationSchema.validate(request.body[BaseKey.EMPLOYEE], { stripUnknown: true })

            const employee = await new EmployeeModel(prisma.employee).create(body)

            response
                .status(201)
                .json({ employee: deserialize(EmployeeSerializer, employee) })

        } catch (error) {
            next(error)
        }

    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const employeeId = Number(request.params["employeeId"])

            if (!employeeId || isNaN(employeeId)) throw new ErrorModel({ statusCode: 422, message: "Employee id missing!", name: "Invalid request" })

            const body = await EmployeeUpdateValidationSchema.validate(request.body[BaseKey.EMPLOYEE], { stripUnknown: true })

            const employee = await new EmployeeModel(prisma.employee).update(employeeId, body)

            response
                .status(200)
                .json({ employee: deserialize(EmployeeSerializer, employee) })

        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const employeeId = Number(request.params["employeeId"])

            if (!employeeId || isNaN(employeeId)) throw new ErrorModel({ statusCode: 422, message: "Employee id missing!", name: "Invalid request" })

            new EmployeeModel(prisma.employee).delete(employeeId)

            response
                .status(200)
                .json({})

        } catch (error) {
            next(error)
        }

    }

    return {
        index,
        create,
        update,
        remove,
        metaIndex,
    }
}

export default EmployeeController