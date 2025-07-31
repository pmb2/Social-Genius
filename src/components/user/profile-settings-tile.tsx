'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRound, Mail, Phone, MapPin, Building, Camera, Check, X } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth/context';
import { Dialog, DialogContent, DialogTitle, DialogClose } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

import { toast } from 'sonner'; // Assuming sonner is installed for toasts
import axios from 'axios'; // Import axios for API calls

interface ProfileSettingsTileProps {
  isStandalone?: boolean;
  onClose?: () => void;
  initialTab?: string;
  initialHighlight?: string;
}

export default function ProfileSettingsTile({ isStandalone = false, onClose, initialTab, initialHighlight }: ProfileSettingsTileProps) {
  const { user, updateUser } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phoneNumber: user?.phoneNumber || '',
    profilePicture: user?.profilePicture || '/default-avatar.png'
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab || "profile");
  const [modelSettings, setModelSettings] = useState({
    apiProvider: "openai",
    apiEndpoint: "",
    apiKey: "",
    modelVersion: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        name: user.name || '',
        email: user.email || '',
        phoneNumber: user.phoneNumber || '',
        profilePicture: user.profilePicture || '/default-avatar.png'
      });
      // Fetch model settings from the database
      fetchModelSettings();
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const handler = setTimeout(() => {
      handleSaveModelSettings();
    }, 500); // Debounce for 500ms

    return () => {
      clearTimeout(handler);
    };
  }, [modelSettings, user]);

  useEffect(() => {
    if (initialHighlight) {
      const element = document.getElementById(initialHighlight);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  }, [initialHighlight]);

  const handleSaveModelSettings = useCallback(async () => {
    if (!user) return; // Only save if user is authenticated

    setSaving(true);
    setError(null);
    try {
      const response = await axios.put('/api/user/settings', { updates: modelSettings });
      if (response.data.success) {
        toast.success('Model settings saved successfully!');
      } else {
        setError(response.data.error || 'Failed to save model settings.');
        toast.error('Failed to save model settings.');
      }
    } catch (err) {
      console.error('Error saving model settings:', err);
      setError('Failed to save model settings.');
      toast.error('Failed to save model settings.');
    } finally {
      setSaving(false);
    }
  }, [modelSettings, user]);

  const fetchModelSettings = async () => {
    try {
      const response = await axios.get('/api/user/settings');
      if (response.data.success && response.data.settings) {
        setModelSettings(response.data.settings);
      }
    } catch (err) {
      console.error('Error fetching model settings:', err);
      toast.error('Failed to load model settings.');
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleProfilePictureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileInput = e.target;
    if (!fileInput.files || fileInput.files.length === 0) return;

    const file = fileInput.files[0];
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file');
      return;
    }
    
    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      setError('Image size must be less than 5MB');
      return;
    }
    
    setUploadingImage(true);
    setError(null);
    
    try {
      // Create FormData object
      const formData = new FormData();
      formData.append('file', file);
      
      // Call API to upload the image
      const response = await fetch('/api/auth/upload', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload image');
      }
      
      const data = await response.json();
      
      // Update the form data with the new profile picture URL
      setFormData(prev => ({
        ...prev,
        profilePicture: data.profilePicture
      }));
      
      // Reset file input
      fileInput.value = '';
    } catch (error) {
      console.error('Error uploading profile picture:', error);
      setError(error instanceof Error ? error.message : 'Failed to upload image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    
    try {
      // Basic validation
      if (!formData.name.trim()) {
        setError('Name is required');
        setSaving(false);
        return;
      }
      
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        setError('Valid email is required');
        setSaving(false);
        return;
      }
      
      // Call the updateUser function with the relevant data
      const success = await updateUser({
        name: formData.name,
        email: formData.email,
        phoneNumber: formData.phoneNumber,
        profilePicture: formData.profilePicture
      });
      
      if (success) {
        // Close the modal after a short delay for better UX
        setTimeout(() => {
          if (isStandalone && onClose) {
            // If this is a standalone component in a parent modal, call the parent close function
            onClose();
          } else {
            // Otherwise, close the component's own modal
            setIsModalOpen(false);
          }
          setSaving(false);
        }, 500);
      } else {
        setError('Failed to update profile. Please try again.');
        setSaving(false);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      setError('An unexpected error occurred');
      setSaving(false);
    }
  };

  // If the component is in standalone mode, render only the form content
  if (isStandalone) {
    return (
      <div className="w-full">
        <div className="flex justify-between items-center mb-6">
          <h2 className="text-xl font-semibold">Profile Settings</h2>
          {onClose && (
            <Button 
              variant="ghost" 
              size="icon"
              onClick={onClose}
              className="h-8 w-8 rounded-full bg-white border shadow-md hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
        
        <div className="flex flex-col md:flex-row gap-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList>
              <TabsTrigger value="profile">Profile</TabsTrigger>
              <TabsTrigger value="api-settings">API Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="profile">
              <div className="flex-shrink-0 flex flex-col items-center">
                <div className="relative mb-4">
                  <div className="rounded-full w-32 h-32 relative overflow-hidden">
                    <Image
                      src={formData.profilePicture}
                      alt="Profile"
                      className={`rounded-full object-cover ${uploadingImage ? 'opacity-50' : ''}`}
                      width={128}
                      height={128}
                      style={{ width: "128px", height: "128px" }}
                    />
                    {uploadingImage && (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    id="profile-picture-upload" 
                    accept="image/*"
                    className="hidden"
                    onChange={handleProfilePictureUpload}
                  />
                  <Button 
                    size="sm"
                    variant="outline"
                    className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 flex items-center justify-center bg-white"
                    onClick={() => document.getElementById('profile-picture-upload')?.click()}
                    disabled={uploadingImage}
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              
              <div className="flex-1 space-y-6">
                {error && (
                  <div className="p-3 mb-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                    {error}
                  </div>
                )}
    
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name-standalone" className="flex items-center gap-1">
                      <UserRound className="h-3.5 w-3.5" />
                      Full Name
                    </Label>
                    <Input
                      id="name-standalone"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Your full name"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="email-standalone" className="flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      Email
                    </Label>
                    <Input
                      id="email-standalone"
                      name="email"
                      type="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="your.email@example.com"
                    />
                  </div>
    
                  <div className="space-y-2">
                    <Label htmlFor="phoneNumber-standalone" className="flex items-center gap-1">
                      <Phone className="h-3.5 w-3.5" />
                      Phone
                    </Label>
                    <Input
                      id="phoneNumber-standalone"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      onChange={handleChange}
                      placeholder="+1 (555) 123-4567"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2 pt-4">
                  {onClose && (
                    <Button variant="outline" onClick={onClose}>
                      Cancel
                    </Button>
                  )}
                  <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-500 to-purple-600">
                    {saving ? (
                      <>
                        <span className="animate-spin mr-2">⟳</span> Saving...
                      </>
                    ) : (
                      <>
                        <Check className="mr-2 h-4 w-4" /> Save Changes
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </TabsContent>
            <TabsContent value="api-settings">
              <div className="space-y-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiProvider" className="text-right">
                    Provider
                  </Label>
                  <select
                    id="apiProvider"
                    value={modelSettings.apiProvider}
                    onChange={(e) => setModelSettings(prev => ({ ...prev, apiProvider: e.target.value }))}
                    className="col-span-3"
                  >
                    <option value="openai">OpenAI</option>
                    <option value="groq">Groq</option>
                    <option value="openrouter">OpenRouter</option>
                    <option value="other">Other</option>
                  </select>
                </div>

                {modelSettings.apiProvider === 'other' && (
                  <div className="grid grid-cols-4 items-center gap-4">
                    <Label htmlFor="otherProvider" className="text-right">
                      Other Provider
                    </Label>
                    <Input
                      id="otherProvider"
                      value={modelSettings.apiProvider}
                      onChange={(e) => setModelSettings(prev => ({ ...prev, apiProvider: e.target.value }))}
                      className="col-span-3"
                      placeholder="Enter provider name"
                    />
                  </div>
                )}

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiEndpoint" className="text-right">
                    API Endpoint
                  </Label>
                  <Input
                    id="apiEndpoint"
                    value={modelSettings.apiEndpoint}
                    onChange={(e) => setModelSettings(prev => ({ ...prev, apiEndpoint: e.target.value }))}
                    className="col-span-3"
                    placeholder="Enter API endpoint"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="apiKey" className="text-right">
                    API Key
                  </Label>
                  <Input
                    id="apiKey"
                    type="password"
                    value={modelSettings.apiKey}
                    onChange={(e) => setModelSettings(prev => ({ ...prev, apiKey: e.target.value }))}
                    className="col-span-3"
                    placeholder="Enter your API Key"
                  />
                </div>

                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="modelVersion" className="text-right">
                    Model Version
                  </Label>
                  <Input
                    id="modelVersion"
                    value={modelSettings.modelVersion}
                    onChange={(e) => setModelSettings(prev => ({ ...prev, modelVersion: e.target.value }))}
                    className="col-span-3"
                    placeholder="e.g., gpt-4, llama3-8b-8192"
                  />
                </div>
              </div>
              
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // Regular card mode for dashboard display
  return (
    <>
      <Card className="p-6 hover:shadow-lg transition-shadow duration-300">
        <div className="flex justify-between items-start">
          <div className="flex items-start space-x-4">
            <div className="bg-gradient-to-r from-blue-500 to-purple-600 p-3 rounded-lg">
              <UserRound className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-medium">Profile Settings</h3>
              <p className="text-sm text-gray-500 mt-1 mb-4">
                Update your personal information and preferences
              </p>
            </div>
          </div>
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsModalOpen(true)}
          >
            Edit
          </Button>
        </div>

        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative mb-2">
              <div className="rounded-full w-24 h-24 relative overflow-hidden">
                <Image
                  src={formData.profilePicture}
                  alt="Profile"
                  className={`rounded-full object-cover ${uploadingImage ? 'opacity-50' : ''}`}
                  width={96}
                  height={96}
                  style={{ width: "96px", height: "96px" }}
                />
                {uploadingImage && (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                  </div>
                )}
              </div>
              <input 
                type="file" 
                id="profile-picture-upload-card" 
                accept="image/*"
                className="hidden"
                onChange={handleProfilePictureUpload}
              />
              <Button 
                size="sm"
                variant="outline"
                className="absolute bottom-0 right-0 rounded-full w-7 h-7 p-0 flex items-center justify-center bg-white"
                onClick={() => document.getElementById('profile-picture-upload-card')?.click()}
                disabled={uploadingImage}
              >
                <Camera className="h-3.5 w-3.5" />
              </Button>
            </div>
            <h4 className="text-lg font-medium">{formData.name || "User"}</h4>
            <p className="text-sm text-gray-500">{formData.email || ""}</p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center py-2 border-b">
              <Mail className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.email || "Not set"}</span>
            </div>
            <div className="flex items-center py-2 border-b">
              <Phone className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.phoneNumber || "Not set"}</span>
            </div>
            {/* Additional profile fields will be shown here as the schema expands */}
          </div>
        </div>
      </Card>

      {/* Profile Settings Modal */}
      <Dialog open={isModalOpen} onOpenChange={(open) => {
        if (!open) {
          // Modal is closing, trigger save
          handleSaveModelSettings();
        }
        setIsModalOpen(open);
      }}>
        <DialogContent className="max-w-md p-0 overflow-visible">
          <DialogTitle className="sr-only">Profile Settings</DialogTitle>
          
          <div className="flex justify-between items-center p-4 border-b">
            <h2 className="text-xl font-semibold">Profile Settings</h2>
            <DialogClose asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 rounded-full bg-white border shadow-md hover:bg-gray-50"
              >
                <X className="h-4 w-4" />
                <span className="sr-only">Close</span>
              </Button>
            </DialogClose>
          </div>
          
          <div className="p-6 space-y-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                <div className="rounded-full w-24 h-24 relative overflow-hidden">
                  <Image
                    src={formData.profilePicture}
                    alt="Profile"
                    className={`rounded-full object-cover ${uploadingImage ? 'opacity-50' : ''}`}
                    width={96}
                    height={96}
                    style={{ width: "96px", height: "96px" }}
                  />
                  {uploadingImage && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                    </div>
                  )}
                </div>
                <input 
                  type="file" 
                  id="profile-picture-upload-modal" 
                  accept="image/*"
                  className="hidden"
                  onChange={handleProfilePictureUpload}
                />
                <Button 
                  size="sm"
                  variant="outline"
                  className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 flex items-center justify-center bg-white"
                  onClick={() => document.getElementById('profile-picture-upload-modal')?.click()}
                  disabled={uploadingImage}
                >
                  <Camera className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-1">
                  <UserRound className="h-3.5 w-3.5" />
                  Full Name
                </Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Your full name"
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="email" className="flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" />
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="your.email@example.com"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="flex items-center gap-1">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </Label>
                <Input
                  id="phoneNumber"
                  name="phoneNumber"
                  value={formData.phoneNumber}
                  onChange={handleChange}
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Future feature: Location field will be added when database schema supports it */}

              {/* Future feature: Company field will be added when database schema supports it */}
            </div>

            {error && (
              <div className="p-3 my-3 bg-red-50 border border-red-200 text-red-600 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="flex justify-end space-x-2 pt-4">
              <Button variant="outline" onClick={() => {
                setIsModalOpen(false);
                setError(null);
                
                // Reset form data to current user data
                if (user) {
                  setFormData({
                    name: user.name || '',
                    email: user.email || '',
                    phoneNumber: user.phoneNumber || '',
                    profilePicture: user.profilePicture || '/default-avatar.png'
                  });
                }
              }}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-blue-500 to-purple-600">
                {saving ? (
                  <>
                    <span className="animate-spin mr-2">⟳</span> Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" /> Save Changes
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}