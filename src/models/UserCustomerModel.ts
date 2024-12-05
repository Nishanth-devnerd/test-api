import { Address } from "@prisma/client";
import { prisma } from "../..";
import { GeolocationParams, GeolocationUpdateParams } from "./GeolocationModel";
import { ErrorModel } from "./ErrorModel";

interface CustomerUpdateParams {
    mail?: string | null
    mobile?: string
    active?: boolean
    name?: string
}

interface AddressParams {
    addressType?: string
    landmark: string | null
    geolocation: GeolocationParams
}
interface AddressUpdateParams {
    addressType?: string
    landmark: string | null
    primaryAddress?: boolean
    geolocation?: GeolocationUpdateParams
}

class UserCustomerModel {
    #prismaCustomer;
    #prismaAddress;

    constructor() {
        this.#prismaCustomer = prisma.user
        this.#prismaAddress = prisma.address
    }

    async show(id: number) {
        return await this.#prismaCustomer.findUnique({
            where: { id }, include: {
                addresses: {
                    orderBy: {
                        createdAt: "desc"
                    },
                    include: {
                        geolocation: true
                    }
                }
            }
        })
    }

    async update(id: number, data: CustomerUpdateParams) {

        return await this.#prismaCustomer.update(
            {
                where: { id },
                data: {
                    name: data.name,
                    mobile: data.mobile,
                    mail: data.mail,
                    active: data.active,
                },
                include: {
                    addresses: {
                        orderBy: {
                            createdAt: "desc"
                        },
                        include: {
                            geolocation: true
                        }
                    }
                }
            })
    }

    async listAddresses(userId: number): Promise<Array<Address>> {
        return await this.#prismaAddress.findMany({
            where: { userId },
            orderBy: { createdAt: "desc" },
            include: { geolocation: true }
        })
    }

    async addAddress(userId: number, address: AddressParams): Promise<Address> {
        const addresses = await this.#prismaAddress.findMany({ where: { userId } })

        return await this.#prismaAddress.create({
            data: {
                user: {
                    connect: { id: userId }
                },
                addressType: address.addressType,
                primaryAddress: !addresses.find(address => address.primaryAddress),
                landmark: address?.landmark,
                geolocation: {
                    create: address.geolocation
                }
            },
            include: { geolocation: true }
        })
    }

    async getPrimaryAddress(userId: number): Promise<Address | null> {
        return await this.#prismaAddress.findFirst({
            where: { userId, primaryAddress: true },
            include: { geolocation: true }
        })
    }

    async updateAddress(id: number, address: AddressUpdateParams): Promise<Address> {
        if (address.primaryAddress) {
            const addressWithUserId = await this.#prismaAddress.findUnique({ where: { id }, select: { userId: true } })
            const updatedCount = await this.#prismaAddress.updateMany({
                data: {
                    primaryAddress: false,
                },
                where: {
                    userId: addressWithUserId?.userId
                }
            })
        }

        return await this.#prismaAddress.update({
            where: {
                id,
            },
            data: {
                addressType: address.addressType,
                primaryAddress: address.primaryAddress,
                landmark: address?.landmark,
                geolocation: {
                    update: {
                        city: address.geolocation?.city,
                        state: address.geolocation?.state,
                        pincode: address.geolocation?.pincode,
                        latitude: address.geolocation?.latitude,
                        longitude: address.geolocation?.longitude,
                        addressLine: address.geolocation?.addressLine,
                    }
                }
            },
            include: { geolocation: true }
        })
    }

    async deleteAddress(id: number) {
        const address = await this.#prismaAddress.findUnique({ where: { id } })
        if (address?.primaryAddress)
            throw new ErrorModel({ statusCode: 422, message: "Primary address can't be deleted", name: "Unable to delete primary address" })
        return await this.#prismaAddress.delete({ where: { id } })
    }
}

export default UserCustomerModel
