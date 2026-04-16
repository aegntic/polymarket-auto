// Flight Tabs Component - Horizontal tabs for flight selection

import React from "react";
import { Box, Text } from "ink";
import { type Flight, CYBER_COLORS, formatPrice } from "../types";

interface Props {
  flights: Flight[];
  selectedIndex: number;
  focused: boolean;
}

export function FlightTabs({ flights, selectedIndex, focused }: Props) {
  if (flights.length === 0) {
    return (
      <Box>
        <Text color={CYBER_COLORS.dim}>No flights available</Text>
      </Box>
    );
  }

  return (
    <Box flexDirection="row" justifyContent="center">
      {flights.map((flight, i) => {
        const isSelected = i === selectedIndex;
        const bgColor = isSelected && focused ? CYBER_COLORS.neonCyan : isSelected ? CYBER_COLORS.neonMagenta : undefined;
        const textColor = isSelected ? "black" : CYBER_COLORS.dim;

        return (
          <Box key={flight.id} marginX={1}>
            <Text backgroundColor={bgColor} color={textColor} bold={isSelected}>
              {` ${flight.flightNumber} ${formatPrice(flight.price, flight.currency)} `}
            </Text>
          </Box>
        );
      })}
    </Box>
  );
}
