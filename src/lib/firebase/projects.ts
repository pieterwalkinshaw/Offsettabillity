import { db, hasFirebaseConfig } from './config';
import { collection, doc, setDoc, getDocs, getDoc, query, where } from 'firebase/firestore';
import type { Project } from '@/types';

// Mock initial data to populate localStorage if empty
const INITIAL_MOCK_PROJECTS: Project[] = [
  {
    projectId: '1',
    title: 'Reforestation in the Amazon',
    category: 'Carbon Removal',
    subCategory: 'Forestry',
    description: 'This project focuses on restoring degraded land in the Brazilian Amazon. Working closely with indigenous communities, it aims to plant 5 million native trees over the next 5 years, restoring critical biodiversity corridors and generating sustainable income for local families.',
    ownerId: 'mock-owner-id',
    location: { lat: -3.4653, lng: -62.2159, address: 'Amazonas, Brazil' },
    fundingGoal: 1000000,
    fundingRaised: 850000,
    impactMetrics: { 
      reportingPeriod: 'Project Duration',
      primaryMetric: { label: 'Total CO2e Removed (t)', value: 15000 }
    },
    verificationScore: 98,
    verificationStatus: 'verified',
    verificationBadge: 'Premium Assured',
    riskLevel: 'low',
    status: 'live',
    auditHistory: [],
    createdAt: new Date().toISOString()
  },
  {
    projectId: '2',
    title: 'Sub-Saharan Solar Wells',
    category: 'Clean Water',
    subCategory: 'Solar',
    description: 'Providing sustainable, solar-powered clean water access to 50 rural communities.',
    ownerId: 'mock-owner-id',
    location: { lat: -1.2921, lng: 36.8219, address: 'Nairobi, Kenya' },
    fundingGoal: 500000,
    fundingRaised: 210000,
    impactMetrics: {
      reportingPeriod: 'Annually',
      primaryMetric: { label: '% Water Quality Improvements', value: '45%' }
    },
    verificationScore: 92,
    verificationStatus: 'verified',
    verificationBadge: 'Verified+',
    riskLevel: 'medium',
    status: 'live',
    auditHistory: [],
    createdAt: new Date().toISOString()
  }
];

const LOCAL_STORAGE_KEY = 'offsettable_projects';

function getLocalProjects(): Project[] {
  if (typeof window === 'undefined') return INITIAL_MOCK_PROJECTS;
  
  const data = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (!data) {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(INITIAL_MOCK_PROJECTS));
    return INITIAL_MOCK_PROJECTS;
  }
  return JSON.parse(data);
}

function saveLocalProjects(projects: Project[]) {
  if (typeof window !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(projects));
  }
}

export async function createProject(project: Project): Promise<void> {
  if (hasFirebaseConfig && db) {
    const projectRef = doc(db, 'projects', project.projectId);
    await setDoc(projectRef, project);
  } else {
    // Fallback to localStorage
    const projects = getLocalProjects();
    projects.push(project);
    saveLocalProjects(projects);
  }
}

export async function getProjects(): Promise<Project[]> {
  if (hasFirebaseConfig && db) {
    const snapshot = await getDocs(collection(db, 'projects'));
    return snapshot.docs.map(doc => doc.data() as Project);
  } else {
    return getLocalProjects();
  }
}

export async function getProjectsByOwner(ownerId: string): Promise<Project[]> {
  if (hasFirebaseConfig && db) {
    const q = query(collection(db, 'projects'), where('ownerId', '==', ownerId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => doc.data() as Project);
  } else {
    return getLocalProjects().filter(p => p.ownerId === ownerId);
  }
}

export async function getProjectById(projectId: string): Promise<Project | null> {
  if (hasFirebaseConfig && db) {
    const docRef = doc(db, 'projects', projectId);
    const snapshot = await getDoc(docRef);
    return snapshot.exists() ? (snapshot.data() as Project) : null;
  } else {
    const project = getLocalProjects().find(p => p.projectId === projectId);
    return project || null;
  }
}
