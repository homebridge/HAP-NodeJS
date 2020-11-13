import { CharacteristicValue, Nullable } from "../../types";
import { CharacteristicProps } from "../Characteristic";

/**
 * Prepares the characteristic value to be sent to the HomeKit controller.
 * This includes changing booleans to 0 or 1 (for lower bandwidth) and converting
 * numbers to the desired minStep (by converting them to a string).
 * The minStep conversion only happens for minStep < 1
 *
 * @param value - The value which should be formatted
 * @param props - The characteristic properties used to format the value.
 * @private
 */
export function formatOutgoingCharacteristicValue(value: Nullable<CharacteristicValue>, props: CharacteristicProps): Nullable<CharacteristicValue>;
export function formatOutgoingCharacteristicValue(value: CharacteristicValue, props: CharacteristicProps): CharacteristicValue
export function formatOutgoingCharacteristicValue(value: Nullable<CharacteristicValue>, props: CharacteristicProps): Nullable<CharacteristicValue> {
  if (typeof value === "boolean") {
    return value? 1: 0;
  } else if (typeof value === "number") {
    if (!props.minStep || props.minStep >= 1) {
      return value;
    }

    let decimalLength = props.minStep.toString().split(".")[1].length;

    const base = props.minValue ?? 0;
    const inverse = 1 / props.minStep;

    return ((Math.round((value - base) * inverse) / inverse) + base).toFixed(decimalLength);
  }

  return value;
}
