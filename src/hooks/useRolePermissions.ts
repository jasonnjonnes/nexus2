import { useEffect, useState } from 'react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { useFirebaseAuth } from '../contexts/FirebaseAuthContext';

export interface RolePermissions {
  customers: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  jobs: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  invoices: {
    create: boolean;
    update: boolean;
    delete: boolean;
  };
  pricebook: {
    update: boolean;
  };
  company: {
    update: boolean;
  };
  users: {
    update: boolean;
  };
  [key: string]: any; // allow future flags
}

const denyAll: RolePermissions = {
  customers: { create: false, update: false, delete: false },
  jobs: { create: false, update: false, delete: false },
  invoices: { create: false, update: false, delete: false },
  pricebook: { update: false },
  company: { update: false },
  users: { update: false }
};

/**
 * React hook that streams permission flags for the current user's role.
 * Permissions live in: /companies/{companyId}/roles/{role}
 */
export const useRolePermissions = () =>   const { tenantId, role } = useFirebaseAuth();
  const [perms, setPerms] = useState<RolePermissions>(denyAll);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenantId || !role) return;

    const ref = doc(db, 'tenants', tenantId, 'roles', role);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        setPerms(snap.data() as RolePermissions);
      } else {
        setPerms(denyAll);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [tenantId, role]);

  return { perms, loading } as const;
}; 