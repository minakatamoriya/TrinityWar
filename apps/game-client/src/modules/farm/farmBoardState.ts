const FARM_BOARD_MESSAGE_MAX_LENGTH = 40;

export type FarmBoardMessageValidation =
  | { valid: true; message: string }
  | { valid: false; message: string; reason: 'empty' | 'too-long' };

export function normalizeFarmBoardMessage(message: string): string {
  return message.trim();
}

export function validateFarmBoardMessage(message: string): FarmBoardMessageValidation {
  const normalizedMessage = normalizeFarmBoardMessage(message);

  if (normalizedMessage.length <= 0) {
    return {
      valid: false,
      message: normalizedMessage,
      reason: 'empty',
    };
  }

  if (Array.from(normalizedMessage).length > FARM_BOARD_MESSAGE_MAX_LENGTH) {
    return {
      valid: false,
      message: normalizedMessage,
      reason: 'too-long',
    };
  }

  return {
    valid: true,
    message: normalizedMessage,
  };
}

export function shouldCloseFarmBoardEditorWithoutSaving(input: {
  initialMessage: string;
  message: string;
}): boolean {
  const currentValidation = validateFarmBoardMessage(input.message);

  if (!currentValidation.valid) {
    return true;
  }

  return currentValidation.message === normalizeFarmBoardMessage(input.initialMessage);
}
