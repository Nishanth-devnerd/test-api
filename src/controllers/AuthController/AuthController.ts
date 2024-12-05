import { ErrorConstants } from '../../shared/constants/ErrorConstants';
import { prisma } from "../../..";
import _ from "lodash";
import { NextFunction, Response } from "express";
import UserModel from "../../models/UserModel";
import { AdminLoginValidationSchema, GetOTPValidationSchema, LoginValidationSchema, RegisterationValidationSchema } from "./AuthController.validation";
import { BaseKey } from "../../shared/constants/BaseKeyConstants";
import { deserialize, serialize } from "serializr";
import { AuthSerializer } from '../../serializers/AuthSerializer';
import { UserSerializer } from '../../serializers/UserSerializer';
import { ErrorModel } from '../../models/ErrorModel';
import Request from '../../shared/interfaces/Request';
import notifyUser from '../../shared/utils/notifyUser';

const AuthController = () => {

    const adminLogin = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await AdminLoginValidationSchema.validate(request.body[BaseKey.AUTH], { stripUnknown: true })
            const user = new UserModel(prisma.user)
            const result = await user.adminLogin(body.mail, body.password)

            response
                .status(201)
                .json({ user: deserialize(AuthSerializer, result) })
        } catch (error) {
            console.log(error)
            next(error)
        }
    }

    const userLogin = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await LoginValidationSchema.validate(request.body[BaseKey.AUTH], { stripUnknown: true })
            const user = new UserModel(prisma.user)
            const result = await user.login(body.mobile, body.otp)

            response
                .status(201)
                .json({ user: deserialize(AuthSerializer, result) })
        } catch (error) {
            next(error)
        }
    }

    const userGetOTP = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await GetOTPValidationSchema.validate(request.body[BaseKey.AUTH], { stripUnknown: true })
            const user = new UserModel(prisma.user)
            const otp = await user.generateOTP(body.mobile)
            otp && notifyUser({ toMobile: body.mobile }, "otp", { otp })
            response
                .status(201)
                .json({ user: { otp } })
        } catch (error) {
            if ((error as ErrorModel)?.statusCode)
                next(error)
            const err = new ErrorModel({
                statusCode: 401,
                message: ErrorConstants.RECORD_NOT_FOUND
                    ? "Unable to find user with given mobile number"
                    : (error as any).message ?? "Unable to generate OTP",
                name: "OTP generation failed"
            })
            next(err)
        }
    }

    const userSignup = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await RegisterationValidationSchema.validate(request.body[BaseKey.AUTH], { stripUnknown: true })
            const user = new UserModel(prisma.user)
            const result = await user.signupUser(body)
            const otp = await user.generateOTP(result.mobile)
            otp && await notifyUser({ toMobile: body.mobile }, "enquiry_otp", { otp })

            response
                .status(201)
                .json({ user: deserialize(AuthSerializer, result), otp })
        } catch (error) {
            next(error)
        }
    }

    const refresh = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const token = request.body["user"]["refreshToken"]
            const user = await new UserModel(prisma.user).refreshToken(token)

            response
                .status(200)
                .json({ user: deserialize(AuthSerializer, user) })
        } catch (error) {
            const err = new ErrorModel({
                statusCode: 401,
                name: "Refresh token generation failed",
                message: (error as any).message ?? "Refresh token expired",
                code: ErrorConstants.AUTH_FAILED,
            })
            next(err)
        }
    }

    const logout = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const userId = request?.user?.id

            if (!userId)
                throw new ErrorModel({ name: "Request unauthenticated", statusCode: 401, message: "Unauthenticated" })

            const user = await new UserModel(prisma.user).logout(userId)

            response
                .status(200)
                .json()
        } catch (error) {
            next(error)
        }
    }

    return {
        logout,
        refresh,
        userLogin,
        userSignup,
        adminLogin,
        userGetOTP,
    }
}

export default AuthController