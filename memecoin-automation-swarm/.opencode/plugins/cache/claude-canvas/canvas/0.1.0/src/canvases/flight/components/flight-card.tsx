// Flight Card Component - Individual flight display

import React from "react";
import { Box, Text } from "ink";
import { type Flight, CYBER_COLORS, formatPrice, formatDuration } from "../types";

interface Props {
  flight: Flight;
  selected: boolean;
  focused: boolean;
}

export function FlightCard({ flight, selected, focused }: Props) {
  const isHighlighted = selected && focused;
  const bgColor = isHighlighted ? CYBER_COLORS.neonCyan : undefined;
  const textColor = isHighlighted ? "black" : selected ? CYBER_COLORS.neonCyan : "white";
  const dimColor = isHighlighted ? "black" : CYBER_COLORS.dim;

  const stopsText = flight.stops === 0 ? "nonstop" : `${flight.stops} stop${flight.stops > 1 ? "s" : ""}`;

  return (
    <Box
      flexDirection="column"
      marginBottom={1}
      paddingX={1}
      backgroundColor={bgColor}
    >
      {/* Line 1: Selector + Flight number + Price */}
      <Box>
        <Text color={textColor} bold>
          {selected ? "> " : "  "}
          {flight.flightNumber.padEnd(8)}
        </Text>
        <Text color={isHighlighted ? "black" : CYBER_COLORS.neonGreen} bold>
          {formatPrice(flight.price, flight.currency)}
        </Text>
      </Box>

      {/* Line 2: Route */}
      <Box>
        <Text color={dimColor}>
          {"  "}
          {flight.origin.code} {"->"} {flight.destination.code}
        </Text>
      </Box>

      {/* Line 3: Duration + Stops */}
      <Box>
        <Text color={dimColor}>
          {"  "}
          {formatDuration(flight.duration)} {stopsText}
        </Text>
      </Box>
    </Box>
  );
}
