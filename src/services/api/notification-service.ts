import { DatabaseService } from '@/services/database';

class NotificationService {
  private static instance: NotificationService;
  private db: DatabaseService;

  private constructor() {
    this.db = DatabaseService.getInstance();
  }

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  /**
   * Create a notification for a user
   * @param userId The user ID to create the notification for
   * @param title The notification title
   * @param message The notification message
   * @param type The notification type: 'info', 'success', 'warning', or 'alert'
   * @returns The ID of the created notification
   */
  public async createNotification(
    userId: number,
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'alert'
  ): Promise<number> {
    return this.db.createNotification(userId, title, message, type);
  }

  /**
   * Create a system notification for all users
   * This can be used for system-wide announcements or alerts
   * @param title The notification title
   * @param message The notification message
   * @param type The notification type
   * @param userIds Optional list of specific user IDs to notify
   */
  public async createSystemNotification(
    title: string,
    message: string,
    type: 'info' | 'success' | 'warning' | 'alert',
    userIds?: number[]
  ): Promise<void> {
    try {
      // If specific user IDs are provided, only notify those users
      if (userIds && userIds.length > 0) {
        for (const userId of userIds) {
          await this.createNotification(userId, title, message, type);
        }
        return;
      }

      // Get all user IDs from the database
      const allUsers = await this.db.getAllUserIds();
      
      // Create notifications for all users
      for (const userId of allUsers) {
        await this.createNotification(userId, title, message, type);
      }
    } catch (error) {
      console.error('Error creating system notification:', error);
      throw error;
    }
  }

  /**
   * Get notifications for a user
   * @param userId The user ID to get notifications for
   * @param limit Optional limit on the number of notifications to return
   * @param unreadOnly Optional flag to only return unread notifications
   */
  public async getNotifications(
    userId: number,
    limit: number = 50,
    unreadOnly: boolean = false
  ) {
    return this.db.getNotifications(userId, limit, unreadOnly);
  }

  /**
   * Get unread notification count for a user
   * @param userId The user ID to get count for
   */
  public async getUnreadCount(userId: number): Promise<number> {
    return this.db.getUnreadNotificationCount(userId);
  }

  /**
   * Mark a notification as read
   * @param notificationId The notification ID
   * @param userId The user ID (for security)
   */
  public async markAsRead(notificationId: number, userId: number): Promise<boolean> {
    return this.db.markNotificationAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read for a user
   * @param userId The user ID
   */
  public async markAllAsRead(userId: number): Promise<number> {
    return this.db.markAllNotificationsAsRead(userId);
  }

  /**
   * Delete a notification
   * @param notificationId The notification ID
   * @param userId The user ID (for security)
   */
  public async deleteNotification(notificationId: number, userId: number): Promise<boolean> {
    return this.db.deleteNotification(notificationId, userId);
  }
}

export default NotificationService;