import { ErrorModel } from './../../models/ErrorModel';
import { AttachmentValidationSchema, PresignValidationSchema } from './AttachmentController.validation';
import { NextFunction, Response } from "express"
import Request from "../../shared/interfaces/Request"
import aws from "aws-sdk"
import { BaseKey } from '../../shared/constants/BaseKeyConstants';
import { randomUUID } from 'crypto';
import { prisma } from '../../..';
import { AttachmentTypes } from '@prisma/client';

const AttachmentController = () => {

    const fetchPresignedUrl = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const body = await PresignValidationSchema.validate(request.body[BaseKey.ATTACHMENT], { stripUnknown: true })

            const ext = body.fileName.split(".")[1]

            const s3Params = {
                Bucket: process.env.S3_BUCKET_NAME,
                Key: `${randomUUID()}.${ext}`,
                Expires: 60 * 60,
                ContentType: `image/${ext}`,
            };

            const presignedUrl = await getPresignUrlPromiseFunction(s3Params);
            response.
                status(200)
                .json({ presignedUrl })
        } catch (error) {
            console.log(error)
            const err = new ErrorModel({
                statusCode: 400,
                message: (error as any).message ?? "Unable to generate presigned URL",
                name: (error as any).name ?? "Presigned URL generation failed"
            })
            next(err)
        }

    }

    const createAttachment = async (request: Request, response: Response, next: NextFunction) => {
        try {
            const data = await AttachmentValidationSchema.validate(request.body[BaseKey.ATTACHMENT], { stripUnknown: true })

            const attachment = await prisma.attachment.create({
                data
            })
            response
                .status(201)
                .json({ attachment })
        } catch (error) {
            next(error)
        }
    }

    const updateAttachment = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const attachmentId = Number(request.params["attachmentId"])

            if (!attachmentId || !Number.isFinite(attachmentId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            const data = await AttachmentValidationSchema.validate(request.body[BaseKey.ATTACHMENT], { stripUnknown: true })

            const attachment = await prisma.attachment.update({
                where: {
                    id: attachmentId
                },
                data
            })
            response
                .status(200)
                .json({ attachment })
        } catch (error) {
            next(error)
        }
    }

    const deleteAttachment = async (request: Request, response: Response, next: NextFunction) => {
        try {

            const attachmentId = Number(request.params["attachmentId"])

            if (!attachmentId || !Number.isFinite(attachmentId))
                throw new ErrorModel({
                    statusCode: 422,
                    message: "Booking id missing!",
                    name: "Invalid request"
                })

            const attachment = await prisma.attachment.findUnique({
                where: {
                    id: attachmentId
                }
            })
            aws.config.update({
                region: process.env.AWS_REGION,
                accessKeyId: process.env.AWS_ACCESS_KEY_ID,
                secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
            });

            const fileName = attachment?.url?.split("/").at(-1) || ""
            const s3Params = {
                Bucket: process.env.S3_BUCKET_NAME || "",
                Key: fileName,
            };

            const s3 = new aws.S3();

            await Promise.all([
                prisma.attachment.delete({
                    where: {
                        id: attachmentId
                    }
                }),
                s3.deleteObject(s3Params).promise()
            ])

            response
                .status(200)
                .json()
        } catch (error) {
            next(error)
        }
    }

    const getPresignUrlPromiseFunction = (s3Params: any): Promise<string> => {
        return new Promise(async (resolve, reject) => {
            try {
                const s3 = new aws.S3({
                    apiVersion: "2006-03-01",
                    region: process.env.AWS_REGION,
                    signatureVersion: "v4",
                });
                s3.getSignedUrl("putObject", s3Params, function (err: any, data: any) {
                    if (err) {
                        return reject(err);
                    }
                    resolve(data);
                });
            } catch (error) {
                return reject(error);
            }
        });
    }

    const indexAttachments = async (request: Request, response: Response, next: NextFunction) => {
        try {
            // await prisma.attachment.deleteMany({})
            const attachments = await prisma.attachment.findMany({
                where: {
                    OR: [
                        { type: AttachmentTypes.home_carousel },
                        { type: AttachmentTypes.home_banner_1 },
                        { type: AttachmentTypes.home_banner_2 },
                        { type: AttachmentTypes.home_banner_3 },
                        { type: AttachmentTypes.home_offer_tile_1 },
                        { type: AttachmentTypes.home_offer_tile_2 },
                        { type: AttachmentTypes.home_offer_tile_3 },
                        { type: AttachmentTypes.home_offer_tile_4 },
                        { type: AttachmentTypes.about_hero_1 },
                        { type: AttachmentTypes.about_hero_2 },
                        { type: AttachmentTypes.about_banner_1 },
                        { type: AttachmentTypes.about_banner_2 },
                    ]
                }
            })
            response
                .status(200)
                .json({ attachments })
        } catch (error) {
            next(error)
        }
    }


    return {
        indexAttachments,
        createAttachment,
        fetchPresignedUrl,
        updateAttachment,
        deleteAttachment,
    }
}
export default AttachmentController