// SPDX-FileCopyrightText: 2025 Contributors to the CitrineOS Project
//
// SPDX-License-Identifier: Apache-2.0

// Re-export internal types and enums
export * from './internal-types.js';

// Export interfaces - these can import from other modules but won't create circular deps
export { AbstractConnectionManager } from './AbstractConnectionManager.js';
export { AbstractMessageHandler } from './AbstractMessageHandler.js';
export { AbstractMessageSender } from './AbstractMessageSender.js';
export type { IConnectionManager } from './IConnectionManager.js';
export { Message } from './Message.js';
export type { IMessage } from './Message.js';
export type { IMessageConfirmation } from './MessageConfirmation.js';
export type { IMessageContext } from './MessageContext.js';
export type { IMessageHandler } from './MessageHandler.js';
export type { IMessageSender } from './MessageSender.js';
