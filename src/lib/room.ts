import { supabase } from "./supabase";

/**
 * Generate a short unique room code (4 alphanumeric chars, uppercase).
 */
function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // Removed ambiguous chars: I, O, 0, 1
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export interface Room {
  id: string;
  room_code: string;
  status: "waiting" | "calibrating" | "active" | "complete";
  player_a_id: string | null;
  player_b_id: string | null;
  player_a_name: string | null;
  player_b_name: string | null;
  created_at: string;
}

/**
 * Create a new room and register the creator as Player A.
 */
export async function createRoom(
  playerId: string,
  playerName: string,
): Promise<{ roomCode: string; roomId: string } | null> {
  // Try up to 5 times in case of room code collision
  for (let attempt = 0; attempt < 5; attempt++) {
    const roomCode = generateRoomCode();

    const { data, error } = await supabase
      .from("rooms")
      .insert({
        room_code: roomCode,
        status: "waiting",
        player_a_id: playerId,
        player_a_name: playerName,
      })
      .select("id, room_code")
      .single();

    if (error) {
      // Unique constraint violation — code already exists, retry
      if (error.code === "23505") continue;
      console.error("Error creating room:", error);
      return null;
    }

    return { roomCode: data.room_code, roomId: data.id };
  }

  console.error("Failed to generate unique room code after 5 attempts");
  return null;
}

/**
 * Join an existing room as Player B.
 * Returns the room if successfully joined, null otherwise.
 */
export async function joinRoom(
  roomCode: string,
  playerId: string,
  playerName: string,
): Promise<Room | null> {
  // First check if room exists and has an open slot
  const { data: room, error: fetchError } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .single();

  if (fetchError || !room) {
    console.error("Room not found:", fetchError);
    return null;
  }

  if (room.status !== "waiting") {
    console.error("Room is not accepting players, status:", room.status);
    return null;
  }

  if (room.player_b_id) {
    console.error("Room is full");
    return null;
  }

  // Don't let a player join their own room
  if (room.player_a_id === playerId) {
    console.error("Cannot join your own room");
    return null;
  }

  // Claim the Player B slot
  const { data: updatedRoom, error: updateError } = await supabase
    .from("rooms")
    .update({
      player_b_id: playerId,
      player_b_name: playerName,
      status: "calibrating",
    })
    .eq("id", room.id)
    .is("player_b_id", null) // Optimistic lock — only update if slot still empty
    .select("*")
    .single();

  if (updateError || !updatedRoom) {
    console.error(
      "Failed to join room (slot may have been taken):",
      updateError,
    );
    return null;
  }

  return updatedRoom as Room;
}

/**
 * Get a room by its code.
 */
export async function getRoomByCode(roomCode: string): Promise<Room | null> {
  const { data, error } = await supabase
    .from("rooms")
    .select("*")
    .eq("room_code", roomCode.toUpperCase())
    .single();

  if (error) {
    console.error("Error fetching room:", error);
    return null;
  }

  return data as Room;
}

/**
 * Update room status.
 */
export async function updateRoomStatus(
  roomId: string,
  status: Room["status"],
): Promise<boolean> {
  const { error } = await supabase
    .from("rooms")
    .update({ status })
    .eq("id", roomId);

  if (error) {
    console.error("Error updating room status:", error);
    return false;
  }
  return true;
}
