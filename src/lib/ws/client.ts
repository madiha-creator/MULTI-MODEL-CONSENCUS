import type { WSMessage, ConnectionState } from '@/types/telemetry';
import { validateMessage, notifyInvalidFrame } from './validate';

type MessageHandler = (msg: WSMessage) => void;
type StatusHandler = (state: ConnectionState) => void;

export class WSClient {
  private ws: WebSocket | null = null;
  private url: string;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeout: ReturnType<typeof setTimeout> | null = null;
  private onMessage: MessageHandler;
  private onStatus: StatusHandler;
  private _connectionState: ConnectionState = 'disconnected';

  constructor(
    url: string,
    onMessage: MessageHandler,
    onStatus: StatusHandler
  ) {
    this.url = url;
    this.onMessage = onMessage;
    this.onStatus = onStatus;
  }

  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  get reconnectCount(): number {
    return this.reconnectAttempts;
  }

  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    this.onStatus(state);
  }

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.setConnectionState('connecting');

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.reconnectAttempts = 0;
        this.setConnectionState('connected');
        this.startHeartbeat();
      };

      this.ws.onmessage = (event: MessageEvent) => {
        try {
          const raw = JSON.parse(event.data);
          const msg = validateMessage(raw);
          if (msg) {
            this.onMessage(msg);
            if (msg.type === 'heartbeat') {
              this.resetHeartbeatTimeout();
            }
          }
        } catch {
          // Non-JSON frame on the wire — counted visibly (Prompt 9: malformed
          // telemetry must be handled safely, not silently swallowed).
          notifyInvalidFrame('parse');
        }
      };

      this.ws.onclose = () => {
        this.stopHeartbeat();
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
          this.setConnectionState('reconnecting');
          this.scheduleReconnect();
        } else {
          this.setConnectionState('disconnected');
        }
      };

      this.ws.onerror = () => {
        // onclose always follows onerror and drives the reconnect decision —
        // no state change here to avoid emitting a transient 'reconnecting'
      };
    } catch {
      if (this.reconnectAttempts < this.maxReconnectAttempts) {
        this.setConnectionState('reconnecting');
        this.scheduleReconnect();
      } else {
        this.setConnectionState('disconnected');
      }
    }
  }

  disconnect(): void {
    this.stopHeartbeat();
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.maxReconnectAttempts;
    if (this.ws) {
      // Detach first: the dying socket's async onclose would otherwise land
      // on the shared store AFTER a StrictMode remount has already connected
      // (stale 'disconnected' → banner flash + overlayState nulling).
      this.ws.onclose = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onopen = null;
      this.ws.close();
      this.ws = null;
    }
    this.setConnectionState('disconnected');
  }

  /**
   * Manual retry from the terminal 'disconnected' state (after the backoff
   * budget is spent). Clears any pending timer and restarts the attempt
   * counter so a fresh series of retries begins.
   */
  retry(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = 0;
    this.connect();
  }

  send(data: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) return;

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect();
    }, delay);
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'heartbeat', payload: { timestamp: Date.now() } }));
      }
    }, 15000);

    this.resetHeartbeatTimeout();
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
      this.heartbeatTimeout = null;
    }
  }

  private resetHeartbeatTimeout(): void {
    if (this.heartbeatTimeout) {
      clearTimeout(this.heartbeatTimeout);
    }
    this.heartbeatTimeout = setTimeout(() => {
      this.setConnectionState('reconnecting');
      this.ws?.close();
    }, 20000);
  }
}
