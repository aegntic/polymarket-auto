// Flight List Component - Scrollable list of flights

import React from "react";
import { Box, Text } from "ink";
import { FlightCard } from "./flight-card";
import { type Flight, CYBER_COLORS } from "../types";

interface Props {
  flights: Flight[];
  selectedIndex: number;
  focused: boolean;
  maxHeight: number;
}

export function FlightList({ flights, selectedIndex, focused, maxHeight }: Props) {
  if (flights.length === 0) {
    return (
      <Box>
        <Text color={CYBER_COLORS.dim}>No flights available</Text>
      </Box>
    );
  }

  // Calculate visible range (simple scrolling)
  const itemHeight = 4; // Each flight card is ~4 lines
  const visibleItems = Math.floor(maxHeight / itemHeight);

  let startIndex = 0;
  if (selectedIndex >= visibleItems) {
    startIndex = selectedIndex - visibleItems + 1;
  }

  const endIndex = Math.min(startIndex + visibleItems, flights.length);
  const visibleFlights = flights.slice(startIndex, endIndex);

  return (
    <Box flexDirection="column">
      {visibleFlights.map((flight, i) => {
        const actualIndex = startIndex + i;
        return (
          <FlightCard
            key={flight.id}
            flight={flight}
            selected={actualIndex === selectedIndex}
            focused={focused}
          />
        );
      })}

      {/* Scroll indicator */}
      {flights.length > visibleItems && (
        <Box marginTop={1}>
          <Text color={CYBER_COLORS.dim}>
            {startIndex > 0 ? "^ " : "  "}
            [{selectedIndex + 1}/{flights.length}]
            {endIndex < flights.length ? " v" : "  "}
          </Text>
        </Box>
      )}
    </Box>
  );
}
