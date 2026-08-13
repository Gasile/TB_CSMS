// =====================================================================
// APPENDIX: EXTRACT OF THE SMART CHARGING ALGORITHM'S BUSINESS LOGIC
// =====================================================================

package smartcharging

import (
	"log"
	"math"
	"sort"
	"time"
)

// EVState represents the state of a charging session as used by the algorithm.
// This structure groups all the decision-making variables.
type EVState struct {
	TransactionID      string
	OcppConnectionName string
	Protocol           string
	EvseID             int
	Weight             int       // Priority allocated to the vehicle
	CurrentConsumption float64   // Real consumption reported by the station (MeterValues)
	AllocatedLimit     float64   // Power limit setpoint calculated by the algorithm
	Locked             bool      // Lock preventing further modification in the same iteration
	StartTime          time.Time // Start time for FIFO (First-In, First-Out) management
}

// ---------------------------------------------------------------------
// 1. CORE DISTRIBUTION LOGIC
// ---------------------------------------------------------------------

// calculateLimits determines the power allocated to each vehicle based on
// the global capacity of the Power Block (maxA), the session weight,
// and the real consumption to optimize available energy.
func calculateLimits(powerBlockID int, maxA float64, evs []*EVState) {
	minAmpsToCharge := 6.0
	maxActiveCars := int(maxA / minAmpsToCharge)

	// Critical case: Insufficient capacity even for a single car
	if maxActiveCars == 0 {
		for _, ev := range evs {
			ev.AllocatedLimit = 0.0
			ev.Locked = true
		}
		return
	}

	// Shortage management: if the number of vehicles exceeds the hardware capacity,
	// we cut off the least priority vehicles (Sorted by weight, then by arrival time).
	if len(evs) > maxActiveCars {
		sort.SliceStable(evs, func(i, j int) bool {
			if evs[i].Weight != evs[j].Weight {
				return evs[i].Weight > evs[j].Weight
			}
			return evs[i].StartTime.Before(evs[j].StartTime)
		})

		for i := maxActiveCars; i < len(evs); i++ {
			evs[i].AllocatedLimit = 0.0
			evs[i].Locked = true
		}
	}

	var unlockedEVs []*EVState
	totalOriginalActiveWeight := 0
	for _, ev := range evs {
		if !ev.Locked {
			unlockedEVs = append(unlockedEVs, ev)
			totalOriginalActiveWeight += ev.Weight
		}
	}

	if len(unlockedEVs) == 0 {
		return
	}

	// If only one vehicle is active, it gets all available power
	if len(unlockedEVs) == 1 {
		unlockedEVs[0].AllocatedLimit = math.Floor(maxA*10) / 10
		unlockedEVs[0].Locked = true
		return
	}

	unallocatedPower := maxA

	// Iteration to detect and redistribute power from vehicles
	// in "underload" (consuming less than what is allocated to them)
	for len(unlockedEVs) > 0 {
		currentIterationWeight := 0
		for _, ev := range unlockedEVs {
			currentIterationWeight += ev.Weight
		}

		if currentIterationWeight == 0 {
			break
		}

		if len(unlockedEVs) == 1 {
			unlockedEVs[0].AllocatedLimit = math.Floor(unallocatedPower)
			unlockedEVs[0].Locked = true
			break
		}

		foundUnderloaded := false

		for i, ev := range unlockedEVs {
			// Note: lastAppliedLimits and gracePeriodCache are global state variables
			currentLimit, exists := lastAppliedLimits[ev.TransactionID]
			graceEnd := gracePeriodCache[ev.TransactionID]

			baseFairShare := math.Floor(maxA * float64(ev.Weight) / float64(totalOriginalActiveWeight))

			if !exists {
				currentLimit = baseFairShare
			}

			// Grace period: allow time for the vehicle to reach its setpoint
			// before potentially considering it underloaded.
			if time.Now().Before(graceEnd) {
				continue
			}

			isFreshUnderload := ev.CurrentConsumption <= (currentLimit - 2.0)
			isStillUnderloaded := currentLimit < baseFairShare

			if isFreshUnderload || isStillUnderloaded {
				neededPower := math.Round(ev.CurrentConsumption) + 1.0

				if neededPower < minAmpsToCharge {
					neededPower = minAmpsToCharge
				}

				iterationFairShare := math.Floor(unallocatedPower * float64(ev.Weight) / float64(currentIterationWeight))

				// If the actual need is lower than the theoretical fair share,
				// we limit the allocation to the actual need to free up the rest.
				if neededPower < iterationFairShare {
					ev.AllocatedLimit = neededPower
					ev.Locked = true
					unallocatedPower -= neededPower

					unlockedEVs = append(unlockedEVs[:i], unlockedEVs[i+1:]...)
					foundUnderloaded = true
					break
				}
			}
		}

		if !foundUnderloaded {
			break
		}
	}

	// If there are unlocked vehicles and energy left to distribute
	if len(unlockedEVs) > 0 {
		distributeWeightedRest(unlockedEVs, unallocatedPower)
	}
}

// ---------------------------------------------------------------------
// 2. FAIR DISTRIBUTION OF THE REMAINDER
// ---------------------------------------------------------------------

// distributeWeightedRest distributes unused energy proportionally to the weight
// while guaranteeing the minimum 6A required to charge an EV.
func distributeWeightedRest(evs []*EVState, remainingPower float64) {
	minAmpsToCharge := 6.0

	var unlocked []*EVState
	for _, ev := range evs {
		unlocked = append(unlocked, ev)
	}

	// Phase 1: Guarantee minimum charge (6A)
	for len(unlocked) > 0 {
		totalWeight := 0
		for _, ev := range unlocked {
			totalWeight += ev.Weight
		}

		if totalWeight == 0 {
			break
		}

		foundUnderMin := false
		for i, ev := range unlocked {
			theoreticalShare := remainingPower * float64(ev.Weight) / float64(totalWeight)

			// If the theoretical share is under the minimum, force 6A and recalculate
			if theoreticalShare < minAmpsToCharge {
				ev.AllocatedLimit = minAmpsToCharge
				ev.Locked = true
				remainingPower -= minAmpsToCharge

				unlocked = append(unlocked[:i], unlocked[i+1:]...)
				foundUnderMin = true
				break
			}
		}

		if !foundUnderMin {
			break
		}
	}

	// Phase 2: Final distribution proportional to weights
	if len(unlocked) > 0 {
		sort.SliceStable(unlocked, func(i, j int) bool {
			if unlocked[i].Weight != unlocked[j].Weight {
				return unlocked[i].Weight > unlocked[j].Weight
			}
			return unlocked[i].StartTime.Before(unlocked[j].StartTime)
		})

		totalWeight := 0
		for _, ev := range unlocked {
			totalWeight += ev.Weight
		}

		tempPower := remainingPower
		for _, ev := range unlocked {
			share := math.Floor(remainingPower * float64(ev.Weight) / float64(totalWeight))
			ev.AllocatedLimit = share
			tempPower -= share
		}

		// Distribution of any remaining amps caused by rounding (math.Floor)
		for i := 0; i < len(unlocked) && tempPower >= 1.0; i++ {
			unlocked[i].AllocatedLimit += 1.0
			tempPower -= 1.0
		}

		for _, ev := range unlocked {
			ev.Locked = true
		}
	}
}

// ---------------------------------------------------------------------
// 3. HARDWARE PROTECTIONS (Extract from execution function)
// ---------------------------------------------------------------------

/*
Logic block applied just before sending the charging profile to the station.
It ensures the preservation of electrical hardware (contactors) and respects
network limitations by avoiding spamming of setpoints.
*/
func validateHardwareConstraints(ev *EVState, lastLimit float64, hasLastLimit bool, lastSendTime time.Time, hasLastSendTime bool) bool {
	// OCPP 1.6 stations are particularly sensitive to frequent variations
	if ev.Protocol == "ocpp1.6" && hasLastLimit {
		delta := math.Abs(ev.AllocatedLimit - lastLimit)
		isCriticalDropToZero := ev.AllocatedLimit == 0.0

		// Rule 1: Minimum delta of 3A (Prevents hardware switching for minor adjustments)
		// Exception made if the charge must absolutely be cut (DropToZero)
		if delta < 3.0 && !isCriticalDropToZero {
			log.Printf("🛡️ [OCPP 1.6] Insufficient delta (%.1fA -> %.1fA). Profile ignored.", lastLimit, ev.AllocatedLimit)
			return false // Refused to apply
		}

		// Rule 2: Strict delay (cooldown) of 5 minutes between sending profiles
		if hasLastSendTime {
			timeSinceLastSend := time.Since(lastSendTime)
			if timeSinceLastSend < 5*time.Minute {
				return false // Refused to apply
			}
		}
	}

	return true // Setpoint validated for sending
}
