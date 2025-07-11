import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Upload, User, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

// Adicionar props para edição
type ProfileCreateProps = {
  initialData?: any;
  isEditMode?: boolean;
};

const ProfileCreate = ({ initialData, isEditMode }: ProfileCreateProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [profileImages, setProfileImages] = useState<string[]>(initialData?.images || []);
  const [formData, setFormData] = useState({
    name: initialData?.name || "",
    age: initialData?.age || "",
    bio: initialData?.bio || "",
    goals: initialData?.goals || [],
    gym: initialData?.gym || "",
    availableDays: initialData?.availableDays || [],
    timePreference: initialData?.timePreference || "",
    lookingFor: initialData?.lookingFor || "both",
    experience: initialData?.experience || "",
  });

  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    if (initialData) {
      setProfileImages(initialData.images || []);
      setFormData({
        name: initialData.name || "",
        age: initialData.age || "",
        bio: initialData.bio || "",
        goals: initialData.goals || [],
        gym: initialData.gym || "",
        availableDays: initialData.availableDays || [],
        timePreference: initialData.timePreference || "",
        lookingFor: initialData.lookingFor || "both",
        experience: initialData.experience || "",
      });
    }
  }, [initialData]);

  const fitnessGoals = [
    "Emagrecimento",
    "Hipertrofia",
    "Cardio",
    "Força",
    "Flexibilidade",
    "Condicionamento",
    "Reabilitação",
    "Bem-estar"
  ];

  const weekDays = [
    "Segunda-feira",
    "Terça-feira", 
    "Quarta-feira",
    "Quinta-feira",
    "Sexta-feira",
    "Sábado",
    "Domingo"
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (profileImages.length + files.length > 5) {
      toast({
        title: "Limite de fotos atingido",
        description: "Você pode adicionar até 5 fotos.",
        variant: "destructive",
      });
      return;
    }
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        setProfileImages((prev) => [...prev, ev.target?.result as string]);
      };
      reader.readAsDataURL(file);
    });
  };

  const removeImage = (idx: number) => {
    setProfileImages((prev) => prev.filter((_, i) => i !== idx));
  };

  const toggleGoal = (goal: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.includes(goal)
        ? prev.goals.filter(g => g !== goal)
        : [...prev.goals, goal]
    }));
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      availableDays: prev.availableDays.includes(day)
        ? prev.availableDays.filter(d => d !== day)
        : [...prev.availableDays, day]
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      if (!formData.name || formData.goals.length === 0) {
        throw new Error("Nome e pelo menos um objetivo são obrigatórios");
      }

      // Upload das imagens para o Supabase Storage
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) throw new Error("Usuário não autenticado");
      const uploadedUrls: string[] = [];
      for (let i = 0; i < profileImages.length; i++) {
        const base64 = profileImages[i];
        // Converter base64 para Blob
        const res = await fetch(base64);
        const blob = await res.blob();
        const filePath = `profile-photos/${user.id}/${Date.now()}-${i}.png`;
        const { error: uploadError } = await supabase.storage.from("profile-photos").upload(filePath, blob, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: publicUrlData } = supabase.storage.from("profile-photos").getPublicUrl(filePath);
        uploadedUrls.push(publicUrlData.publicUrl);
      }

      if (isEditMode) {
        // UPDATE apenas se já existe
        const { error: updateError } = await supabase.from("profiles").update({
          full_name: formData.name,
          name: formData.name,
          age: formData.age ? Number(formData.age) : null,
          bio: formData.bio,
          objectives: formData.goals,
          availability: formData.availableDays,
          location: formData.gym,
          experience_level: formData.experience,
          gym: formData.gym,
          images: uploadedUrls,
          avatar_url: uploadedUrls[0] || null,
          updated_at: new Date().toISOString(),
        }).eq("id", user.id);
        if (updateError) throw updateError;
        toast({
          title: "Perfil atualizado com sucesso!",
          description: "Suas alterações foram salvas.",
        });
      } else {
        // INSERT apenas se não existe
        const { error: insertError } = await supabase.from("profiles").insert({
          id: user.id,
          email: user.email,
          full_name: formData.name,
          name: formData.name,
          age: formData.age ? Number(formData.age) : null,
          bio: formData.bio,
          objectives: formData.goals,
          availability: formData.availableDays,
          location: formData.gym,
          experience_level: formData.experience,
          gym: formData.gym,
          images: uploadedUrls,
          avatar_url: uploadedUrls[0] || null,
          updated_at: new Date().toISOString(),
        });
        if (insertError) throw insertError;
        toast({
          title: "Perfil criado com sucesso!",
          description: "Agora você pode começar a encontrar parceiros de treino",
        });
      }
      navigate("/dashboard");
    } catch (error: any) {
      toast({
        title: isEditMode ? "Erro ao atualizar perfil" : "Erro ao criar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen py-8 px-4 bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gradient mb-2">Crie seu Perfil</h1>
          <p className="text-muted-foreground">Conte um pouco sobre você e seus objetivos fitness</p>
        </div>

        <Card className="border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Informações Básicas
            </CardTitle>
            <CardDescription>
              Essas informações ajudarão a encontrar os melhores parceiros de treino para você
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Fotos de Perfil */}
              <div className="flex flex-col items-center space-y-4">
                <div className="flex gap-2 flex-wrap justify-center">
                  {profileImages.map((img, idx) => (
                    <div key={idx} className="relative group">
                      <Avatar className="w-20 h-20">
                        <AvatarImage src={img} />
                        <AvatarFallback className="bg-primary/10 text-primary text-2xl">
                          <User className="h-8 w-8" />
                        </AvatarFallback>
                      </Avatar>
                      <button
                        type="button"
                        className="absolute -top-2 -right-2 bg-destructive text-white rounded-full p-1 opacity-80 hover:opacity-100 transition-opacity z-10"
                        onClick={() => removeImage(idx)}
                        title="Remover foto"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  {profileImages.length < 5 && (
                    <Button asChild variant="outline" size="sm" className="flex items-center gap-2 h-20 w-20 justify-center">
                      <label htmlFor="image-upload" className="cursor-pointer m-0 flex flex-col items-center justify-center w-full h-full">
                        <Upload className="h-6 w-6 mb-1" />
                        <span className="text-xs">Adicionar</span>
                      </label>
                    </Button>
                  )}
                </div>
                <Input
                  id="image-upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
              </div>

              {/* Nome e Idade */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nome *</Label>
                  <Input
                    id="name"
                    placeholder="Seu nome"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="age">Idade</Label>
                  <Input
                    id="age"
                    type="number"
                    placeholder="25"
                    value={formData.age}
                    onChange={(e) => setFormData(prev => ({ ...prev, age: e.target.value }))}
                  />
                </div>
              </div>

              {/* Bio */}
              <div className="space-y-2">
                <Label htmlFor="bio">Sobre você</Label>
                <Textarea
                  id="bio"
                  placeholder="Conte um pouco sobre você, sua experiência com exercícios e o que te motiva..."
                  value={formData.bio}
                  onChange={(e) => setFormData(prev => ({ ...prev, bio: e.target.value }))}
                  rows={3}
                />
              </div>

              {/* Objetivos */}
              <div className="space-y-3">
                <Label>Objetivos Fitness *</Label>
                <p className="text-sm text-muted-foreground">Selecione todos os seus objetivos</p>
                <div className="flex flex-wrap gap-2">
                  {fitnessGoals.map((goal) => (
                    <Badge
                      key={goal}
                      variant={formData.goals.includes(goal) ? "default" : "outline"}
                      className="cursor-pointer hover:bg-primary/80 transition-colors"
                      onClick={() => toggleGoal(goal)}
                    >
                      {goal}
                    </Badge>
                  ))}
                </div>
              </div>

              {/* Academia e Experiência */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="gym">Academia Preferida</Label>
                  <Input
                    id="gym"
                    placeholder="Nome da academia ou região"
                    value={formData.gym}
                    onChange={(e) => setFormData(prev => ({ ...prev, gym: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="experience">Nível de Experiência</Label>
                  <Select 
                    value={formData.experience} 
                    onValueChange={(value) => setFormData(prev => ({ ...prev, experience: value }))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="beginner">Iniciante</SelectItem>
                      <SelectItem value="intermediate">Intermediário</SelectItem>
                      <SelectItem value="advanced">Avançado</SelectItem>
                      <SelectItem value="expert">Expert</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Dias Disponíveis */}
              <div className="space-y-3">
                <Label>Dias Disponíveis</Label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                  {weekDays.map((day) => (
                    <div key={day} className="flex items-center space-x-2">
                      <Checkbox
                        id={day}
                        checked={formData.availableDays.includes(day)}
                        onCheckedChange={() => toggleDay(day)}
                      />
                      <Label htmlFor={day} className="text-sm cursor-pointer">
                        {day.slice(0, 3)}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preferência de Horário */}
              <div className="space-y-2">
                <Label htmlFor="timePreference">Horário Preferido</Label>
                <Select 
                  value={formData.timePreference} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, timePreference: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Quando prefere treinar?" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="morning">Manhã (6h-12h)</SelectItem>
                    <SelectItem value="afternoon">Tarde (12h-18h)</SelectItem>
                    <SelectItem value="evening">Noite (18h-22h)</SelectItem>
                    <SelectItem value="flexible">Flexível</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* O que está procurando */}
              <div className="space-y-2">
                <Label htmlFor="lookingFor">O que você está procurando?</Label>
                <Select 
                  value={formData.lookingFor} 
                  onValueChange={(value) => setFormData(prev => ({ ...prev, lookingFor: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="both">Parceiros e Personal Trainers</SelectItem>
                    <SelectItem value="partners">Apenas Parceiros de Treino</SelectItem>
                    <SelectItem value="trainers">Apenas Personal Trainers</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button 
                type="submit" 
                className="w-full btn-gradient hover:opacity-90 transition-opacity" 
                disabled={isLoading}
              >
                {isLoading ? "Criando perfil..." : "Criar Perfil"}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ProfileCreate;
