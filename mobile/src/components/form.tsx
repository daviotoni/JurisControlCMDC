import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import React, { useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fmtBR, parseYMD, ymd } from '../lib/dates';
import { useTheme } from '../theme/ThemeContext';
import { fonts } from '../theme/tokens';

export function FieldLabel({ label }: { label: string }) {
  const { colors } = useTheme();
  return (
    <Text style={{ fontFamily: fonts.semibold, fontSize: 12, color: colors.textSecondary, marginBottom: 6 }}>
      {label}
    </Text>
  );
}

/** Campo de texto com rótulo (inputs raio 11px, borda #e3e9f1). */
export function Field({
  label,
  style,
  multiline,
  ...props
}: TextInputProps & { label: string; style?: ViewStyle }) {
  const { colors } = useTheme();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <FieldLabel label={label} />
      <TextInput
        placeholderTextColor={colors.mutedLight}
        multiline={multiline}
        {...props}
        style={[
          styles.input,
          {
            backgroundColor: colors.card === '#ffffff' ? '#fff' : colors.input,
            borderColor: colors.inputBorder,
            color: colors.text,
          },
          multiline && { minHeight: 92, textAlignVertical: 'top' },
        ]}
      />
    </View>
  );
}

/** Campo de data (dd/mm/aaaa) usando o picker nativo. Valor em YYYY-MM-DD. */
export function DateField({
  label,
  value,
  onChange,
  style,
}: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const current = parseYMD(value) ?? new Date();
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <FieldLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          styles.rowBetween,
          { backgroundColor: colors.card === '#ffffff' ? '#fff' : colors.input, borderColor: colors.inputBorder },
        ]}
      >
        <Text style={{ fontFamily: fonts.medium, fontSize: 14, color: value ? colors.text : colors.mutedLight }}>
          {value ? fmtBR(value) : 'dd/mm/aaaa'}
        </Text>
        <Feather name="calendar" size={16} color={colors.muted} />
      </Pressable>
      {open && (
        <DateTimePicker
          value={new Date(current.getUTCFullYear(), current.getUTCMonth(), current.getUTCDate())}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, date) => {
            setOpen(false);
            if (event.type !== 'dismissed' && date) {
              onChange(ymd(new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))));
            }
          }}
        />
      )}
    </View>
  );
}

/** Select simples: abre uma folha inferior com as opções. */
export function SelectField<T extends string>({
  label,
  value,
  options,
  onChange,
  placeholder = 'Selecionar…',
  renderDot,
  style,
}: {
  label: string;
  value: T | undefined;
  options: { key: T; label: string }[];
  onChange: (v: T) => void;
  placeholder?: string;
  renderDot?: (key: T) => string | null;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.key === value);
  return (
    <View style={[{ marginBottom: 14 }, style]}>
      <FieldLabel label={label} />
      <Pressable
        onPress={() => setOpen(true)}
        style={[
          styles.input,
          styles.rowBetween,
          { backgroundColor: colors.card === '#ffffff' ? '#fff' : colors.input, borderColor: colors.inputBorder },
        ]}
      >
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
          {selected && renderDot && renderDot(selected.key) ? (
            <View style={[styles.dot, { backgroundColor: renderDot(selected.key)! }]} />
          ) : null}
          <Text
            numberOfLines={1}
            style={{ fontFamily: fonts.medium, fontSize: 14, color: selected ? colors.text : colors.mutedLight, flex: 1 }}
          >
            {selected ? selected.label : placeholder}
          </Text>
        </View>
        <Feather name="chevron-down" size={16} color={colors.muted} />
      </Pressable>
      <SheetModal visible={open} onClose={() => setOpen(false)} title={label}>
        <ScrollView style={{ maxHeight: 380 }}>
          {options.map((o) => {
            const active = o.key === value;
            return (
              <Pressable
                key={o.key}
                onPress={() => { onChange(o.key); setOpen(false); }}
                style={[styles.optionRow, { borderBottomColor: colors.divider }]}
              >
                {renderDot && renderDot(o.key) ? (
                  <View style={[styles.dot, { backgroundColor: renderDot(o.key)! }]} />
                ) : null}
                <Text
                  style={{
                    fontFamily: active ? fonts.bold : fonts.medium,
                    fontSize: 14.5,
                    color: active ? colors.primary : colors.text,
                    flex: 1,
                  }}
                >
                  {o.label}
                </Text>
                {active ? <Feather name="check" size={17} color={colors.primary} /> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      </SheetModal>
    </View>
  );
}

/** Folha inferior genérica (modais de filtro, formulários rápidos, confirmação). */
export function SheetModal({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View
          style={[
            styles.sheet,
            { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 },
          ]}
        >
          <View style={[styles.grabber, { backgroundColor: colors.border }]} />
          {title ? (
            <View style={styles.sheetHeader}>
              <Text style={{ fontFamily: fonts.bold, fontSize: 16.5, color: colors.text, flex: 1 }}>{title}</Text>
              <Pressable onPress={onClose} hitSlop={10}>
                <Feather name="x" size={20} color={colors.muted} />
              </Pressable>
            </View>
          ) : null}
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Confirmação destrutiva simples (substitui o confirm() do web). */
export function ConfirmSheet({
  visible,
  onClose,
  title,
  message,
  confirmLabel = 'Confirmar',
  onConfirm,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  const { colors } = useTheme();
  return (
    <SheetModal visible={visible} onClose={onClose} title={title}>
      <Text style={{ fontFamily: fonts.regular, fontSize: 14, color: colors.textSecondary, marginBottom: 18, lineHeight: 20 }}>
        {message}
      </Text>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Pressable
          onPress={onClose}
          style={[styles.confirmBtn, { borderWidth: 1.5, borderColor: colors.border }]}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: colors.text }}>Cancelar</Text>
        </Pressable>
        <Pressable
          onPress={() => { onClose(); onConfirm(); }}
          style={[styles.confirmBtn, { backgroundColor: '#b42323' }]}
        >
          <Text style={{ fontFamily: fonts.bold, fontSize: 14.5, color: '#fff' }}>{confirmLabel}</Text>
        </Pressable>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderRadius: 11,
    paddingHorizontal: 13,
    paddingVertical: 12,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dot: { width: 9, height: 9, borderRadius: 5 },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(8,20,38,.55)',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  grabber: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: 10,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 13,
    borderBottomWidth: 1,
  },
  confirmBtn: {
    flex: 1,
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: 'center',
  },
});
