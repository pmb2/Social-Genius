'use client';

import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { UserRound, Mail, Phone, MapPin, Building, Camera, Check } from 'lucide-react';
import Image from 'next/image';
import { useAuth } from '@/lib/auth-context';

export default function ProfileSettingsTile() {
  const { user, updateUser } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    company: user?.company || '',
    profilePicture: user?.profilePicture || '/images/default-avatar.png'
  });
  const [saving, setSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // In a real app, you would call updateUser with the form data
      // await updateUser(formData);
      console.log('Saving user data:', formData);
      setTimeout(() => {
        setSaving(false);
        setIsEditing(false);
      }, 1000);
    } catch (error) {
      console.error('Error saving profile:', error);
      setSaving(false);
    }
  };

  return (
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
        {!isEditing && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => setIsEditing(true)}
          >
            Edit
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="mt-4 space-y-4">
          <div className="flex flex-col items-center mb-6">
            <div className="relative">
              <Image
                src={formData.profilePicture}
                alt="Profile"
                className="rounded-full w-24 h-24 object-cover"
                width={96}
                height={96}
              />
              <Button 
                size="sm"
                variant="outline"
                className="absolute bottom-0 right-0 rounded-full w-8 h-8 p-0 flex items-center justify-center bg-white"
              >
                <Camera className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
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
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" />
                Phone
              </Label>
              <Input
                id="phone"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                placeholder="+1 (555) 123-4567"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="location" className="flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" />
                Location
              </Label>
              <Input
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                placeholder="City, Country"
              />
            </div>

            <div className="space-y-2 md:col-span-2">
              <Label htmlFor="company" className="flex items-center gap-1">
                <Building className="h-3.5 w-3.5" />
                Company
              </Label>
              <Input
                id="company"
                name="company"
                value={formData.company}
                onChange={handleChange}
                placeholder="Your company name"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-2 pt-4">
            <Button variant="outline" onClick={() => setIsEditing(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
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
      ) : (
        <div className="mt-6 space-y-4">
          <div className="flex flex-col items-center mb-6">
            <Image
              src={formData.profilePicture}
              alt="Profile"
              className="rounded-full w-24 h-24 object-cover mb-2"
              width={96}
              height={96}
            />
            <h4 className="text-lg font-medium">{formData.name || "User"}</h4>
            <p className="text-sm text-gray-500">{formData.company || ""}</p>
          </div>

          <div className="grid gap-3">
            <div className="flex items-center py-2 border-b">
              <Mail className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.email || "Not set"}</span>
            </div>
            <div className="flex items-center py-2 border-b">
              <Phone className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.phone || "Not set"}</span>
            </div>
            <div className="flex items-center py-2 border-b">
              <MapPin className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.location || "Not set"}</span>
            </div>
            <div className="flex items-center py-2">
              <Building className="text-gray-400 h-4 w-4 mr-3" />
              <span className="text-sm text-gray-700">{formData.company || "Not set"}</span>
            </div>
          </div>
        </div>
      )}
    </Card>
  );
}