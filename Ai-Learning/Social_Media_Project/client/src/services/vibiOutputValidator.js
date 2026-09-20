/**
 * client/src/services/vibiOutputValidator.js
 * ===========================================
 * VIBGRID — VIBI AI ASSISTANT: PHASE 5 AI OUTPUT & TOOL-CALL VALIDATOR
 *
 * Responsibilities:
 * - Validates all intent outputs, action requests, and AI tool calls.
 * - Rejects unregistered, malformed, or unsafe actions before execution.
 * - Enforces schema type checking and enum whitelisting.
 * - Enforces interactive confirmation requirements for sensitive actions.
 */

import vibiActionRegistry from './vibiActionRegistry';

export const SAFETY_TIERS = {
  READ_ONLY: 'READ_ONLY',
  STATE_MUTATING: 'STATE_MUTATING',
  DESTRUCTIVE: 'DESTRUCTIVE'
};

export class VibiOutputValidator {
  /**
   * Validate a proposed action and its parameters
   * @param {string} actionId - Whitelisted action identifier
   * @param {Object} [params={}] - Parameters passed to the action
   * @param {Object} [options={}] - Validation options (e.g. { confirmed: true, doubleConfirmed: true })
   * @returns {{ valid: boolean, action?: Object, sanitizedParams?: Object, safetyTier?: string, pendingConfirmation?: boolean, error?: string }}
   */
  validateAction(actionId, params = {}, options = {}) {
    // 1. Action ID must be provided
    if (!actionId || typeof actionId !== 'string') {
      return {
        valid: false,
        error: 'invalid_action_id: Action ID must be a non-empty string.'
      };
    }

    const cleanActionId = actionId.trim();

    // 2. Action Registry Whitelist Check
    const actionDef = vibiActionRegistry.getAction(cleanActionId);
    if (!actionDef) {
      return {
        valid: false,
        error: `unregistered_action: '${cleanActionId}' is not an approved or registered Vibi action.`
      };
    }

    // 3. Validate Parameters against Action Schema
    const schema = actionDef.paramsSchema || {};
    const sanitizedParams = {};

    for (const [paramName, rules] of Object.entries(schema)) {
      const value = params ? params[paramName] : undefined;

      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        return {
          valid: false,
          error: `missing_required_param: Missing required parameter '${paramName}' for action '${cleanActionId}'.`
        };
      }

      if (value !== undefined && value !== null) {
        // Type checking
        if (rules.type === 'string') {
          if (typeof value !== 'string') {
            return {
              valid: false,
              error: `type_mismatch: Parameter '${paramName}' must be a string.`
            };
          }
          // Enum validation
          if (Array.isArray(rules.enum) && !rules.enum.includes(value.toLowerCase().trim())) {
            return {
              valid: false,
              error: `invalid_enum_value: Parameter '${paramName}' value '${value}' is not allowed. Allowed: ${rules.enum.join(', ')}.`
            };
          }
          sanitizedParams[paramName] = value.toLowerCase().trim();
        } else if (rules.type === 'boolean') {
          if (typeof value !== 'boolean') {
            return {
              valid: false,
              error: `type_mismatch: Parameter '${paramName}' must be a boolean.`
            };
          }
          sanitizedParams[paramName] = value;
        } else if (rules.type === 'number') {
          if (typeof value !== 'number' || isNaN(value)) {
            return {
              valid: false,
              error: `type_mismatch: Parameter '${paramName}' must be a number.`
            };
          }
          sanitizedParams[paramName] = value;
        } else {
          sanitizedParams[paramName] = value;
        }
      }
    }

    // 4. Action Safety Classification & Confirmation Check
    const safetyTier = actionDef.safetyTier || (actionDef.requiresConfirmation ? SAFETY_TIERS.STATE_MUTATING : SAFETY_TIERS.READ_ONLY);
    let pendingConfirmation = false;

    if (safetyTier === SAFETY_TIERS.DESTRUCTIVE) {
      // Destructive actions strictly require double-confirmation
      pendingConfirmation = !options.doubleConfirmed;
    } else if (actionDef.requiresConfirmation || safetyTier === SAFETY_TIERS.STATE_MUTATING) {
      // State mutating actions require interactive confirmation
      pendingConfirmation = Boolean(actionDef.requiresConfirmation) && !options.confirmed;
    }

    return {
      valid: true,
      action: actionDef,
      sanitizedParams,
      safetyTier,
      pendingConfirmation
    };
  }
}

const vibiOutputValidator = new VibiOutputValidator();
export default vibiOutputValidator;

