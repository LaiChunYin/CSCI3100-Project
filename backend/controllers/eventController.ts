import { Prisma } from "@prisma/client";
import { randomUUID } from "crypto";
import { NextFunction, Request, Response } from "express";
import { body, param, validationResult } from "express-validator";
import photoUploadS3 from "../AWS/photoUploader";
import prisma, { prismaErrorHandler } from "../common/dbClient";
import HttpException from "../common/httpException";
import { generateFriendsList, generateFOFList } from "../services/friendService";
import { eventCategory, EventCategoryType, eventPrivacy, EventPrivacyType } from "../types/sharedTypes";

export const validateUpsert = [
  body("id").optional().isInt().toInt(),
  body("name").isString(),
  body("category").isIn(eventCategory),
  body("time").isInt().toInt(),
  body("duration").isInt().toInt(),
  body("location").isString(),
  body("privacy").isIn(eventPrivacy),
  body("max_participants").isInt().toInt(),
  body("photo").optional().isString().matches("data:image/.*;base64,.*"),
  body("coordinate_lon").optional().isFloat().toFloat(),
  body("coordinate_lat").optional().isFloat().toFloat(),
  body("remarks").optional().isString(),
];

export const upsert = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpException(422, "Invalid input " + JSON.stringify(errors.array())));
  }
  const userId = req.id;

  const id = req.body.id as number | undefined;
  const { name, location, photo, remarks } = req.body;
  const category = req.body.category as EventCategoryType;
  const privacy = req.body.privacy as EventPrivacyType;
  const time = req.body.time as number;
  const duration = req.body.duration as number;
  const maxParticipants = req.body.max_participants as number;
  const coordinateLat = req.body.coordinate_lat as number | undefined;
  const coordinateLon = req.body.coordinate_lon as number | undefined;
  const photoBase64 = req.body.photo as string | undefined;
  let photoUrl: string | null = null;

  // try upload photo
  if (photoBase64) {
    try {
      const key = randomUUID();
      photoUrl = await photoUploadS3(key, photoBase64);
    } catch (e) {
      return next(new HttpException(500, "AWS Error " + e));
    }
  }

  let event = {
    name,
    owner: { connect: { id: userId } },
    category,
    startsAt: new Date(time * 1000), // js Date accepts millis, not seconds
    duration,
    location,
    privacy,
    maxParticipants,
    coordinateLat,
    coordinateLon,
    remarks,
    ...(photoBase64 && { photoUrl }),
  };

  let result;
  try {
    switch (req.method) {
      case "POST": // create
        result = await prisma.event.create({
          data: {
            ...event,
            participants: { connect: { id: userId } },
          },
        });
        break;
      case "PUT": // update
        if (id === undefined) {
          return next(new HttpException(422, "Invalid input"));
        }
        result = await prisma.event.update({
          where: { id },
          data: event,
        });
    }
  } catch (e) {
    return next(prismaErrorHandler(e));
  }

  res.status(201).send({ event: result });
};

// -----------------------------------------------------------------------------

export const validateGet = [param("id").isInt().toInt()];

export const get = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpException(422, "Invalid input"));
  }

  const userId = req.id;
  const id = req.params.id as unknown as number;

  // check if event exists
  let event = null;
  try {
    event = await prisma.event.findFirst({
      where: { id },
      include: { comments: true, participants: true, owner: true },
    });
    if (!event) {
      throw "Not found";
    }
  } catch (e) {
    return next(new HttpException(409, "Event not found"));
  }

  // check if user can view the event
  const privacy = event.privacy as EventPrivacyType;
  switch (privacy) {
    case "only-me":
      if (event.ownerId !== userId) {
        return next(new HttpException(401, "Access denied for this event"));
      }
      break;

    case "friends":
      const friendsList = await generateFriendsList(userId);

      if (!friendsList.includes(event.ownerId)) {
        return next(new HttpException(401, "Access denied for this event"));
      }
      break;

    case "friends-of-friends": {
      const friendsList = await generateFOFList(userId);

      if (!friendsList.includes(event.ownerId)) {
        return next(new HttpException(401, "Access denied for this event"));
      }
      break;
    }
  }

  return res.send({ event });
};

// -----------------------------------------------------------------------------

export const validateRemove = [body("id").isInt().toInt()];

export const remove = async (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return next(new HttpException(422, "Invalid input"));
  }

  const userId = req.id;
  const id = req.body.id as number;

  // check if event exists
  let event = null;
  try {
    event = await prisma.event.findFirst({ where: { id, ownerId: userId } });
    if (!event) {
      throw "Not found";
    }

    const deleteEvent = await prisma.event.delete({ where: { id } });
  } catch (e) {
    return next(new HttpException(409, "Event not found"));
  }

  res.send({});
};
