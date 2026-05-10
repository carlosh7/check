export interface CheckClientOptions {
    apiKey: string;
    baseUrl?: string;
    timeout?: number;
}

export interface CheckEvent {
    id: string;
    name: string;
    date: string;
    location: string;
    status: string;
}

export interface CheckGuest {
    id: string;
    name: string;
    email: string;
    organization: string;
    checked_in: number;
    checkin_time: string | null;
    created_at: string;
}

export interface ListResponse<T> {
    data: T[];
    total: number;
}

export interface SingleResponse<T> {
    data: T;
}

export class CheckClient {
    constructor(options: CheckClientOptions);
    getEvents(): Promise<ListResponse<CheckEvent>>;
    getEvent(id: string): Promise<SingleResponse<CheckEvent>>;
    getEventGuests(eventId: string): Promise<ListResponse<CheckGuest>>;
}
