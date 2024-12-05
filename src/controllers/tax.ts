import { Response, NextFunction } from "express"
import Request from "../shared/interfaces/Request"
import TaxService from "../services/tax"
import { TaxUpdationSchema } from "../validations/tax"
import { BaseKey } from "../shared/constants/BaseKeyConstants"


const TaxController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const taxes = await new TaxService().index()
            response.status(200).json({ taxes })
        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const { taxName, taxPercent } = await TaxUpdationSchema.validate(
                request.body[BaseKey.TAX],
                { stripUnknown: true, abortEarly: false }
            );

            const tax = await new TaxService().update(taxName, taxPercent)

            response.status(200).json({ tax })
        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        update,
    }
}

export default TaxController