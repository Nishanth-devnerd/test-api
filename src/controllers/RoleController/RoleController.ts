import { NextFunction, Response } from "express";
import Request from "../../shared/interfaces/Request";
import { prisma } from "../../..";

const RoleController = () => {

    const index = async (request: Request, response: Response, next: NextFunction) => {
        const roles = await prisma.role.findMany()
        response
            .status(200)
            .json({ roles })
    }

    return {
        index
    }
}

export default RoleController