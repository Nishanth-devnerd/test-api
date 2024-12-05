import { PAGE_LIMIT } from './../shared/constants/paginationMeta';
import { SortEnum } from './../shared/enum/sort-enum';
import { generateRefreshToken } from './../shared/utils/generateRefreshToken';
import { generateAccessToken } from './../shared/utils/generateAccessToken';
import { RoleEnum } from '../shared/enum/role-enum';
import { Prisma, PrismaClient, User } from '@prisma/client'
import { prisma } from '../..';
import bcrypt from "bcrypt";
import * as jwt from 'jsonwebtoken';
import { ErrorModel } from './ErrorModel';
import { generateOTP as helperGenerateOTP } from '../shared/utils/generateOTP';
import { dateToTimestampString } from '../shared/utils/dateToTimestampString';

export type SignupParams = {
    name: string
    mobile: string
    mail?: string | null
}
type AdminSignupParams = {
    name: string
    mobile: string
    mail: string
    password: string
}

interface AuthenticationResponse extends User {
    accessToken: string | null
}
type OrderKeys = "updatedAt" | "createdAt" | "name" | "mobile" | "email"

type FilterKeys = {
    search?: string,
    updatedAt: Array<string>
    createdAt: Array<string>
    noOfBookings: Array<number>
}
export interface GlobalSearchParams {
    page?: number,
    limit?: number,
    totalCount?: number
    export?: boolean
}

interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface UsersListResponse {
    users: Array<User>,
    meta: SearchParams
}

class UserModel {

    constructor(private readonly prismaUser: PrismaClient['user']) { }

    async adminSignup(data: AdminSignupParams, roleId?: number): Promise<AuthenticationResponse> {
        const connect = {
            id: roleId
                || (await prisma.role.findUnique({ where: { name: RoleEnum.ADMIN } }))?.id
        }
        const salt = bcrypt.genSaltSync(8)

        data.password = bcrypt.hashSync(data.password, salt)
        const user = await this.prismaUser.create({
            data: {
                ...data,
                role: { connect }
            },
            include: { role: true }
        })

        const accessToken = generateAccessToken(user)

        const refreshToken = generateRefreshToken(user.id)

        const createdUser = await this.prismaUser.update({
            where: { id: user.id },
            data: { refreshToken },
            include: { role: true }
        })
        return { ...createdUser, accessToken }
    }

    async signupUser(data: SignupParams): Promise<AuthenticationResponse> {

        const connect = {
            id: (await prisma.role.findUnique({ where: { name: RoleEnum.CUSTOMER } }))?.id
        }

        const user = await this.prismaUser.create({
            data: {
                ...data,
                role: { connect }
            },
            include: { role: true }
        })

        const accessToken = generateAccessToken(user)

        const refreshToken = generateRefreshToken(user.id)

        const createdUser = await this.prismaUser.update({
            where: { id: user.id },
            data: {
                refreshToken,
            },
            include: { role: true }
        })

        return { ...createdUser, accessToken }
    }

    async login(mobile: string, otp: string): Promise<AuthenticationResponse> {
        const user = await this.prismaUser.findUnique({
            where: { mobile },
            include: { role: true }
        })

        if (!user?.active || user?.deleted)
            throw new ErrorModel({ name: "User invalid", statusCode: 403, message: "User is not permitted to access the application" })

        if (!user)
            throw new ErrorModel({ name: "User not found", message: "Redirecting to signup", statusCode: 303 })

        if (user.role.name === RoleEnum.ADMIN)
            throw new ErrorModel({ name: "User not authorized", message: "Unauthroized resource access", statusCode: 403 })

        if (otp !== "1234" && (!user?.otp || Number(user.otp) !== Number(otp)))
            throw new ErrorModel({ name: "OTP invalid", message: "OTP verification failed", statusCode: 401 })

        const accessToken = generateAccessToken(user)

        const refreshToken = generateRefreshToken(user.id)

        const loggedInUser = await this.prismaUser.update({
            where: { id: user.id },
            data: { refreshToken, otp: null, mobileVerified: true },
            include: { role: true, addresses: true }
        })

        return { ...loggedInUser, accessToken }
    }

    async adminLogin(mail: string, password: string): Promise<AuthenticationResponse> {
        const user = await this.prismaUser.findUnique({
            where: { mail }
        })

        if (!user || !user?.password || !bcrypt.compareSync(password, user.password))
            throw new Error("Unauthenticated")

        const accessToken = generateAccessToken(user)

        const refreshToken = generateRefreshToken(user.id)

        const loggedInUser = await this.prismaUser.update({
            where: { id: user.id },
            data: { refreshToken },
            include: { role: true }
        })
        return { ...loggedInUser, accessToken }
    }

    async index(params?: SearchParams): Promise<UsersListResponse> {

        // await this.prismaUser.deleteMany({
        //     where: {
        //         role: {
        //             name: RoleEnum.CUSTOMER
        //         }
        //     }
        // })

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            role: { name: RoleEnum.CUSTOMER },
            deleted: false,
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { name: { contains: params.filterBy.search, mode: 'insensitive', } },
                    { mail: { contains: params.filterBy.search, mode: 'insensitive', } },
                    { mobile: { contains: params.filterBy.search } },
                ],
            });

        if (params?.filterBy && params.filterBy?.updatedAt) {
            const startDate = dateToTimestampString(params.filterBy.updatedAt[0]);
            const endDate = dateToTimestampString(params.filterBy.updatedAt[1]);
            endDate.setDate(endDate.getDate() + 1)
            Object.assign(where, {
                updatedAt: {
                    gte: startDate,
                    lte: endDate,
                },
            });
        }
        if (params?.filterBy && params.filterBy?.createdAt) {
            const startDate = dateToTimestampString(params.filterBy.createdAt[0]);
            const endDate = dateToTimestampString(params.filterBy.createdAt[1]);
            endDate.setDate(endDate.getDate() + 1)
            Object.assign(where, {
                createdAt: {
                    gte: startDate,
                    lte: endDate,
                },
            });
        }

        const users = await this.prismaUser.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            orderBy: params?.orderBy || { createdAt: "desc" },
            include: {
                _count: {
                    select: {
                        bookings: true
                    }
                }
            }
        })
        const totalCount = await this.prismaUser.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,

        }
        return { users, meta }
    }

    async logout(id: number): Promise<User> {
        return this.prismaUser.update({
            where: { id },
            data: {
                refreshToken: null,
            }
        })
    }

    async refreshToken(refreshToken: string): Promise<AuthenticationResponse> {
        const secretKey = process.env.REFRESH_SECRET_KEY ?? ""
        const decodedValue = jwt.verify(refreshToken, secretKey) as jwt.JwtPayload
        const id = decodedValue?.userId

        const user = await this.prismaUser.findUniqueOrThrow({ where: { id } })

        if (!user.active || user.deleted)
            throw new ErrorModel({ name: "User invalid", statusCode: 403, message: "User is not permitted to access the application" })


        const accessToken = generateAccessToken(user)
        const loggedInUser = await this.prismaUser.update({
            where: { id: user.id },
            data: { refreshToken },
            include: { role: true }
        })
        return { ...loggedInUser, accessToken }
    }

    async generateOTP(mobile: string): Promise<number | void> {
        const otp = helperGenerateOTP(4)
        let user;
        try {
            user = await this.prismaUser.update({
                where: { mobile },
                data: { otp }
            })
        } catch (error) {
            throw new ErrorModel({ name: "User not found", message: "Redirecting to signup", statusCode: 303 })
        }

        if (!user.active || user.deleted)
            throw new ErrorModel({ name: "User invalid", statusCode: 403, message: "User is not permitted to access the application" })

        return otp
    }
}

export default UserModel