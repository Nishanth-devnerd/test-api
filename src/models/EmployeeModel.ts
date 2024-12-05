import { GlobalSearchParams } from './UserModel';
import { Employee, PrismaClient } from "@prisma/client";
import { SortEnum } from '../shared/enum/sort-enum';
import { PAGE_LIMIT } from '../shared/constants/paginationMeta';

type EmployeeParams = {
    id?: number
    name: string
    mobile: string
}

type EmployeeUpdateParams = {
    name?: string
    mobile?: string
}

type OrderKeys = "createdAt" | "name" | "mobile"

type FilterKeys = {
    search?: string
    blocked?: boolean
}
interface SearchParams extends GlobalSearchParams {
    orderBy?: Record<OrderKeys, SortEnum>
    filterBy?: FilterKeys
}

interface EmployeesListResponse {
    employees: Array<Employee>,
    meta: SearchParams
}

class EmployeeModel {

    constructor(private readonly prismaEmployee: PrismaClient['employee']) { }

    async index(params?: SearchParams): Promise<EmployeesListResponse> {

        const take = params?.limit || PAGE_LIMIT;
        const skip = ((params?.page || 1) - 1) * take;

        const where = {
            deleted: false,
            // blocked: false,
        };

        if (params?.filterBy?.search)
            Object.assign(where, {
                OR: [
                    { name: { contains: params.filterBy.search, mode: 'insensitive' } },
                    { mobile: { contains: params.filterBy.search } },
                ],
            });

        if (params?.filterBy?.blocked !== undefined || params?.filterBy?.blocked !== null)
            Object.assign(where, {
                blocked: params?.filterBy?.blocked
            });


        const employees = await this.prismaEmployee.findMany({
            ...(!params?.export ? { take, skip } : {}),
            where,
            include: {
                _count: {
                    select: {
                        bookings: true
                    }
                }
            },
            orderBy: params?.orderBy || { createdAt: "desc" }
        })

        const totalCount = await this.prismaEmployee.count({ where })

        const meta: SearchParams = {
            page: 1,
            limit: PAGE_LIMIT,
            ...params,
            totalCount,

        }
        return { employees, meta }
    }

    async metaIndex(search?: string): Promise<Array<Employee>> {

        const where = {
            deleted: false,
            blocked: false,
        };

        if (search)
            Object.assign(where, {
                OR: [
                    { name: { contains: search, mode: 'insensitive' } },
                ],
            });

        const employees = await this.prismaEmployee.findMany({
            where,
            orderBy: { createdAt: "desc" }
        })

        return employees
    }



    async create(data: EmployeeParams): Promise<Employee> {

        return await this.prismaEmployee.create({ data })
    }

    async update(id: number, data: EmployeeUpdateParams): Promise<Employee> {
        return await this.prismaEmployee.update(
            {
                where: { id },
                data
            }
        )
    }

    async delete(id: number): Promise<Employee> {
        return await this.prismaEmployee.update(
            {
                where: { id },
                data: { deleted: true }
            }
        )
    }
}

export default EmployeeModel