import { Response, NextFunction } from "express"
import Request from "../shared/interfaces/Request"
import { BaseKey } from "../shared/constants/BaseKeyConstants"
import MeetOurTeamService from "../services/meetOurTeam"
import { ErrorModel } from "../models/ErrorModel"
import { MeetOurTeamSchema, MeetOurTeamUpdateSchema } from "../validations/meetOurTeam"


const MeetOurTeamController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const members = await new MeetOurTeamService().index()
            response.status(200).json({ members })
        } catch (error) {
            next(error)
        }
    }

    const create = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const data = await MeetOurTeamSchema.validate(
                request.body[BaseKey.MEMBER],
                { stripUnknown: true, abortEarly: false }
            );

            const member = await new MeetOurTeamService().create(data)

            response.status(200).json({ member })
        } catch (error) {
            next(error)
        }
    }

    const update = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const memberId = +request.params["memberId"]

            if (!memberId || isNaN(memberId)) throw new ErrorModel({ statusCode: 422, message: "Branch blog id missing!", name: "Invalid request" })

            const data = await MeetOurTeamUpdateSchema.validate(
                request.body[BaseKey.MEMBER],
                { stripUnknown: true, abortEarly: false }
            );

            const member = await new MeetOurTeamService().update(memberId, data)

            response.status(200).json({ member })
        } catch (error) {
            next(error)
        }
    }

    const remove = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const memberId = +request.params["memberId"]

            if (!memberId || isNaN(memberId)) throw new ErrorModel({ statusCode: 422, message: "Branch blog id missing!", name: "Invalid request" })

            const member = await new MeetOurTeamService().remove(memberId)

            response.status(200).json({})
        } catch (error) {
            next(error)
        }
    }

    return {
        index,
        create,
        update,
        remove,
    }
}

export default MeetOurTeamController