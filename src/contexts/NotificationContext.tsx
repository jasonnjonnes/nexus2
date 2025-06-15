import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { collection, query, where, orderBy, onSnapshot, addDoc, updateDoc, doc } from 'firebase/firestore';
import { useFirebaseAuth } from './FirebaseAuthContext';
import { db } from '../firebase';

interface Notification {
  id: string;
  type: 'clock_in_reminder' | 'task_assignment' | 'payroll_update' | 'system' | 'payment_received';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  actionLabel?: string;
  priority: 'low' | 'medium' | 'high';
  userId: string;
  tenantId: string;
}

interface TimeEntry {
  id: string;
  userId: string;
  clockInTime: string;
  clockOutTime?: string;
  totalHours?: number;
  status: 'clocked_in' | 'clocked_out';
  date: string;
  notes?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  currentTimeEntry: TimeEntry | null;
  isClockedIn: boolean;
  
  // Notification methods
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  addNotification: (notification: Omit<Notification, 'id' | 'createdAt' | 'userId' | 'tenantId'>) => Promise<void>;
  
  // Time tracking methods
  clockIn: (notes?: string) => Promise<void>;
  clockOut: (notes?: string) => Promise<void>;
  getCurrentTimeEntry: () => TimeEntry | null;
  
  // Clock-in reminder
  showClockInReminder: boolean;
  dismissClockInReminder: () => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const { user, tenantId } = useFirebaseAuth();
  const userId = user?.uid;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentTimeEntry, setCurrentTimeEntry] = useState<TimeEntry | null>(null);
  const [showClockInReminder, setShowClockInReminder] = useState(false);

  // Load notifications
  useEffect(() => {
    if (!db || !userId || !tenantId) {
      setIsLoading(false);
      return;
    }

    const notificationsQuery = query(
      collection(db, 'tenants', tenantId, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(notificationsQuery, (snapshot) => {
      const notificationsData: Notification[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        notificationsData.push({
          id: doc.id,
          type: data.type || 'system',
          title: data.title || '',
          message: data.message || '',
          read: data.read || false,
          createdAt: data.createdAt || new Date().toISOString(),
          actionUrl: data.actionUrl,
          actionLabel: data.actionLabel,
          priority: data.priority || 'medium',
          userId: data.userId || userId,
          tenantId: data.tenantId || tenantId
        });
      });
      setNotifications(notificationsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, userId, tenantId]);

  // Load current time entry
  useEffect(() => {
    if (!db || !userId || !tenantId) return;

    const today = new Date().toISOString().split('T')[0];
    const timeEntriesQuery = query(
      collection(db, 'tenants', tenantId, 'timeEntries'),
      where('userId', '==', userId),
      where('date', '==', today),
      where('status', '==', 'clocked_in')
    );

    const unsubscribe = onSnapshot(timeEntriesQuery, (snapshot) => {
      if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const data = doc.data();
        setCurrentTimeEntry({
          id: doc.id,
          userId: data.userId,
          clockInTime: data.clockInTime,
          clockOutTime: data.clockOutTime,
          totalHours: data.totalHours,
          status: data.status,
          date: data.date,
          notes: data.notes
        });
      } else {
        setCurrentTimeEntry(null);
      }
    });

    return () => unsubscribe();
  }, [db, userId, tenantId]);

  // Clock-in reminder logic
  useEffect(() => {
    if (!currentTimeEntry) {
      const now = new Date();
      const hour = now.getHours();
      const day = now.getDay(); // 0 = Sunday, 1 = Monday, etc.
      
      // Show reminder on weekdays between 8 AM and 10 AM if not clocked in
      if (day >= 1 && day <= 5 && hour >= 8 && hour < 10) {
        const reminderShown = localStorage.getItem(`clockInReminder_${new Date().toDateString()}`);
        if (!reminderShown) {
          setShowClockInReminder(true);
        }
      }
    }
  }, [currentTimeEntry]);

  const unreadCount = notifications.filter(n => !n.read).length;
  const isClockedIn = currentTimeEntry?.status === 'clocked_in';

  const markAsRead = async (notificationId: string) => {
    if (!db || !tenantId) return;
    
    try {
      await updateDoc(doc(db, 'tenants', tenantId, 'notifications', notificationId), {
        read: true,
        readAt: new Date().toISOString()
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    }
  };

  const markAllAsRead = async () => {
    if (!db || !tenantId) return;
    
    try {
      const unreadNotifications = notifications.filter(n => !n.read);
      const promises = unreadNotifications.map(notification =>
        updateDoc(doc(db, 'tenants', tenantId, 'notifications', notification.id), {
          read: true,
          readAt: new Date().toISOString()
        })
      );
      await Promise.all(promises);
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
    }
  };

  const addNotification = async (notification: Omit<Notification, 'id' | 'createdAt' | 'userId' | 'tenantId'>) => {
    if (!db || !userId || !tenantId) return;
    
    try {
      await addDoc(collection(db, 'tenants', tenantId, 'notifications'), {
        ...notification,
        userId,
        tenantId,
        createdAt: new Date().toISOString(),
        read: false
      });
    } catch (error) {
      console.error('Error adding notification:', error);
    }
  };

  const clockIn = async (notes?: string) => {
    if (!db || !userId || !tenantId) return;
    
    try {
      const now = new Date();
      const timeEntry = {
        userId,
        tenantId,
        clockInTime: now.toISOString(),
        status: 'clocked_in',
        date: now.toISOString().split('T')[0],
        notes: notes || '',
        createdAt: now.toISOString()
      };

      await addDoc(collection(db, 'tenants', tenantId, 'timeEntries'), timeEntry);
      
      // Add notification
      await addNotification({
        type: 'system',
        title: 'Clocked In',
        message: `You clocked in at ${now.toLocaleTimeString()}`,
        priority: 'low'
      });
    } catch (error) {
      console.error('Error clocking in:', error);
      throw error;
    }
  };

  const clockOut = async (notes?: string) => {
    if (!db || !userId || !tenantId || !currentTimeEntry) return;
    
    try {
      const now = new Date();
      const clockInTime = new Date(currentTimeEntry.clockInTime);
      const totalHours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);

      await updateDoc(doc(db, 'tenants', tenantId, 'timeEntries', currentTimeEntry.id), {
        clockOutTime: now.toISOString(),
        status: 'clocked_out',
        totalHours: Math.round(totalHours * 100) / 100,
        notes: notes || currentTimeEntry.notes,
        updatedAt: now.toISOString()
      });
      
      // Add notification
      await addNotification({
        type: 'system',
        title: 'Clocked Out',
        message: `You clocked out at ${now.toLocaleTimeString()}. Total hours: ${Math.round(totalHours * 100) / 100}`,
        priority: 'low'
      });
    } catch (error) {
      console.error('Error clocking out:', error);
      throw error;
    }
  };

  const getCurrentTimeEntry = () => currentTimeEntry;

  const dismissClockInReminder = () => {
    setShowClockInReminder(false);
    localStorage.setItem(`clockInReminder_${new Date().toDateString()}`, 'true');
  };

  const value: NotificationContextType = {
    notifications,
    unreadCount,
    isLoading,
    currentTimeEntry,
    isClockedIn,
    markAsRead,
    markAllAsRead,
    addNotification,
    clockIn,
    clockOut,
    getCurrentTimeEntry,
    showClockInReminder,
    dismissClockInReminder
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}; 