import type { PrismaClient } from '@prisma/client';

import { prisma } from '../../db/prisma.js';

export const deliveryTypes = ['forward', 'fallback'] as const;

export type DeliveryType = (typeof deliveryTypes)[number];

export type CreateDeliveryData = {
  trackingId: string;
  channelMessageId: number;
  deliveryType: DeliveryType;
  deliveredAt: Date;
};

export class DeliveryRepository {
  constructor(private readonly client: PrismaClient = prisma) {}

  async exists(trackingId: string, channelMessageId: number): Promise<boolean> {
    const delivery = await this.client.delivery.findUnique({
      where: {
        trackingId_channelMessageId: {
          trackingId,
          channelMessageId,
        },
      },
      select: {
        id: true,
      },
    });

    return delivery !== null;
  }

  create(data: CreateDeliveryData) {
    return this.client.delivery.create({
      data,
    });
  }
}
